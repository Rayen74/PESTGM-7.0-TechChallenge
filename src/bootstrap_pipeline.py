"""
Bootstrap catch-up pipeline: 2024-01-01 -> today, in 90-day chunks.

WHAT THIS DOES:
The original training data stops at 31/12/2023. This script walks forward
from there to today in 90-day blocks:
    1. Pull REAL weather from Open-Meteo Historical API.
    2. Compute H_sun and G(i) with pvlib.
    3. Predict P using the current accepted model (keras_nn; Random Forest forbidden).
       Enforces physical night constraint (P=0 when H_sun <= 0).
    4. Append rows with P_source='predicted'.
    5. Retrain candidate model on the full accumulated dataset (using scaling for keras_nn).
    6. Compare candidate RMSE against fixed real 2017-2019 validation set.
    7. Accept candidate only if validation RMSE does not degrade.
    8. Advance to next block.

NOTE ON CAPACITY NORMALIZATION:
All P values are normalized per 1 kWp installed capacity (W/kWp).

Run with:
    python -m src.bootstrap_pipeline --model keras_nn
    python -m src.bootstrap_pipeline --model keras_nn --chunk-days 90
"""

import argparse
import shutil
import time
from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone

from src import config
from src.data_loader import load_raw_data
from src.feature_engineering import build_features, get_feature_columns
from src.scaling import load_feature_scaler, scale_features, apply_scaler
from src.models import get_model_registry
from src.evaluate import evaluate
from src.forecast import GOVERNORATES, compute_h_sun_and_gi, raw_weather_to_engineered_features
from src.retrain import fetch_historical_window

BOOTSTRAP_START = datetime(2024, 1, 1, tzinfo=timezone.utc)

RAW_SCHEMA_COLS = [
    "year", "month", "day", "hour", "location", "latitude", "longitude",
    "G(i)", "H_sun", "T2m", "WS10m", "relative_humidity_2m", "cloud_cover",
    "wind_direction_10m", "pressure_msl", "precipitation", "dew_point_2m",
    "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "P", "P_source",
]

PROGRESS_MARKER = config.DATA_PROCESSED_DIR / "bootstrap_progress.txt"
LOG_PATH = config.DATA_PROCESSED_DIR / "bootstrap_log.csv"
ORIGINAL_BACKUP = config.DATA_RAW_DIR / "final_merged_dataset.original_backup.csv"


def ensure_backup_and_provenance_column():
    """
    Backs up the untouched original dataset once, and ensures P_source='real'
    is present on all original rows.
    """
    if not ORIGINAL_BACKUP.exists():
        shutil.copy(config.RAW_CSV_PATH, ORIGINAL_BACKUP)
        print(f"Backed up untouched original dataset to {ORIGINAL_BACKUP}")

    df = pd.read_csv(config.RAW_CSV_PATH)
    if "P_source" not in df.columns:
        df["P_source"] = "real"
        df.to_csv(config.RAW_CSV_PATH, index=False)
        print("Added P_source='real' to all existing rows.")


def get_resume_point() -> datetime:
    if PROGRESS_MARKER.exists():
        text = PROGRESS_MARKER.read_text().strip()
        return datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return BOOTSTRAP_START


def set_resume_point(dt: datetime):
    PROGRESS_MARKER.write_text(dt.strftime("%Y-%m-%d"))


def log_chunk_decision(chunk_start, chunk_end, old_rmse, new_rmse, decision):
    row = pd.DataFrame([{
        "chunk_start": chunk_start.strftime("%Y-%m-%d"),
        "chunk_end": chunk_end.strftime("%Y-%m-%d"),
        "accepted_rmse_before": old_rmse,
        "candidate_rmse": new_rmse,
        "decision": decision,
        "logged_at": datetime.now(timezone.utc).isoformat(),
    }])
    header = not LOG_PATH.exists()
    row.to_csv(LOG_PATH, mode="a", header=header, index=False)


def predict_chunk_for_gov(gov_name: str, lat: float, lon: float,
                          chunk_start: datetime, chunk_end: datetime,
                          model, needs_scaling: bool = True, scaler = None) -> pd.DataFrame:
    """
    Returns a RAW-schema dataframe for one governorate's chunk with predicted P.
    Enforces P=0 at night.
    """
    raw = fetch_historical_window(lat, lon, chunk_start, chunk_end)
    raw = compute_h_sun_and_gi(raw, lat, lon)

    engineered = raw_weather_to_engineered_features(raw, gov_name, lat, lon)
    meta_cols = ["time", "governorate", "district", "G(i)", "H_sun", "T2m", "WS10m", "relative_humidity_2m"]
    feature_cols = [c for c in engineered.columns if c not in meta_cols and c != "P_source"]
    X = engineered[feature_cols].copy()

    if hasattr(model, "feature_names_in_"):
        X = X[list(model.feature_names_in_)]

    if needs_scaling and scaler is not None:
        X_in = apply_scaler(scaler, X)
    else:
        X_in = X

    predicted_p = np.asarray(model.predict(X_in), dtype=float).ravel()

    # Physics enforcement: zero power at night
    h_sun = raw["H_sun"].values
    gi = raw["G(i)"].values
    night_mask = (h_sun <= 0.0) | (gi <= 0.5)
    predicted_p[night_mask] = 0.0
    predicted_p = np.maximum(0.0, predicted_p)

    out = pd.DataFrame({
        "year": raw["time"].dt.year,
        "month": raw["time"].dt.month,
        "day": raw["time"].dt.day,
        "hour": raw["time"].dt.hour,
        "location": gov_name,
        "latitude": lat,
        "longitude": lon,
        "G(i)": raw["G(i)"],
        "H_sun": raw["H_sun"],
        "T2m": raw["temperature_2m"],
        "WS10m": raw["wind_speed_10m"],
        "relative_humidity_2m": raw["relative_humidity_2m"],
        "cloud_cover": raw[["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"]].max(axis=1),
        "wind_direction_10m": raw["wind_direction_10m"],
        "pressure_msl": raw["pressure_msl"],
        "precipitation": raw["precipitation"],
        "dew_point_2m": raw["dew_point_2m"],
        "cloud_cover_low": raw["cloud_cover_low"],
        "cloud_cover_mid": raw["cloud_cover_mid"],
        "cloud_cover_high": raw["cloud_cover_high"],
        "P": np.round(predicted_p, 2),
        "P_source": "predicted",
    })
    return out[RAW_SCHEMA_COLS]


def append_chunk_all_govs(chunk_start: datetime, chunk_end: datetime, model,
                          governorates: dict, needs_scaling: bool = True, scaler = None) -> int:
    chunk_frames = []
    for gov_name, (lat, lon) in governorates.items():
        print(f"  {gov_name}: fetching {chunk_start:%Y-%m-%d} -> {chunk_end:%Y-%m-%d} ...")
        chunk_frames.append(predict_chunk_for_gov(
            gov_name, lat, lon, chunk_start, chunk_end, model, needs_scaling, scaler
        ))
        time.sleep(0.15)

    chunk_df = pd.concat(chunk_frames, ignore_index=True)
    existing = pd.read_csv(config.RAW_CSV_PATH)
    combined = pd.concat([existing, chunk_df], ignore_index=True)
    combined.to_csv(config.RAW_CSV_PATH, index=False)
    return len(chunk_df)


def get_bootstrap_train_and_fixed_val(df: pd.DataFrame):
    """
    Train = original training years (<= TRAIN_END_YEAR) + bootstrap rows (year >= 2024).
    Validation = fixed, real, untouched 2017-2019 window.
    """
    train_mask = (df["year"] <= config.TRAIN_END_YEAR) | (df["year"] >= 2024)
    val_mask = (df["year"] > config.TRAIN_END_YEAR) & (df["year"] <= config.VAL_END_YEAR)
    return df[train_mask].reset_index(drop=True), df[val_mask].reset_index(drop=True)


def retrain_candidate_and_compare(model_name: str, accepted_rmse: float):
    """
    Retrains a fresh candidate on the full accumulated dataset and compares against
    the fixed validation set.
    """
    if model_name in config.FORBIDDEN_MODELS or "forest" in model_name:
        raise ValueError(f"Model '{model_name}' is forbidden. Use '{config.DEFAULT_MODEL}'.")

    raw_df = load_raw_data()
    engineered = build_features(raw_df)
    feature_cols = [c for c in get_feature_columns(engineered) if c != "P_source"]

    train_df, val_df = get_bootstrap_train_and_fixed_val(engineered)
    X_train, y_train = train_df[feature_cols], train_df[config.TARGET]
    X_val, y_val = val_df[feature_cols], val_df[config.TARGET]

    registry = get_model_registry()
    spec = registry[model_name]
    candidate = clone(spec["model"]) if hasattr(spec["model"], "__sklearn_clone__") else spec["model"].__class__()
    needs_scaling = spec["needs_scaling"]

    if needs_scaling:
        # Fit scaler on accumulated training data
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        X_train_scaled = pd.DataFrame(scaler.fit_transform(X_train), columns=X_train.columns)
        X_val_scaled = pd.DataFrame(scaler.transform(X_val), columns=X_val.columns)
        Xtr, Xval = X_train_scaled, X_val_scaled
    else:
        scaler = None
        Xtr, Xval = X_train, X_val

    print(f"  Retraining {model_name} on {len(Xtr):,} rows...")
    candidate.fit(Xtr, y_train)

    val_pred = candidate.predict(Xval)
    metrics = evaluate(y_val, val_pred, set_name=f"{model_name} candidate — fixed validation ({len(Xval):,} rows)")
    candidate_rmse = metrics["RMSE"]

    accepted = (accepted_rmse is None) or (candidate_rmse <= accepted_rmse * 1.01)
    return candidate, scaler, candidate_rmse, accepted


def get_current_accepted_rmse(model_name: str):
    metrics_path = config.METRICS_DIR / "model_comparison.csv"
    if not metrics_path.exists():
        return None
    df = pd.read_csv(metrics_path)
    row = df[df["model"] == model_name]
    return row["RMSE"].iloc[0] if not row.empty else None


def run(model_name: str = config.DEFAULT_MODEL, chunk_days: int = 90):
    if model_name in config.FORBIDDEN_MODELS or "forest" in model_name:
        raise ValueError(f"Model '{model_name}' is forbidden. Use '{config.DEFAULT_MODEL}'.")

    ensure_backup_and_provenance_column()

    model_path = config.MODELS_DIR / f"{model_name}.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"{model_path} not found. Please train it first.")

    registry = get_model_registry()
    needs_scaling = registry[model_name]["needs_scaling"]
    scaler = load_feature_scaler() if needs_scaling else None

    accepted_rmse = get_current_accepted_rmse(model_name)
    print(f"Starting accepted model: {model_name}, validation RMSE = {accepted_rmse}")
    print(f"Capacity note: {config.NORMALIZATION_NOTE}")

    chunk_start = get_resume_point()
    today = datetime.now(timezone.utc)

    if chunk_start >= today:
        print("Already caught up to today. Nothing to do.")
        return

    while chunk_start < today:
        chunk_end = min(chunk_start + timedelta(days=chunk_days), today)
        print(f"\n=== Chunk: {chunk_start:%Y-%m-%d} -> {chunk_end:%Y-%m-%d} ===")

        accepted_model = joblib.load(model_path)
        n_added = append_chunk_all_govs(
            chunk_start, chunk_end, accepted_model, GOVERNORATES, needs_scaling, scaler
        )
        print(f"  Appended {n_added:,} predicted rows across {len(GOVERNORATES)} governorates.")

        candidate, new_scaler, candidate_rmse, accepted = retrain_candidate_and_compare(model_name, accepted_rmse)

        if accepted:
            joblib.dump(candidate, model_path, compress=3)
            if new_scaler is not None:
                joblib.dump(new_scaler, config.MODELS_DIR / "feature_scaler.joblib")
            print(f"  ACCEPTED — candidate RMSE {candidate_rmse:.4f} <= previous {accepted_rmse}")
            accepted_rmse = candidate_rmse
        else:
            print(f"  REJECTED — candidate RMSE {candidate_rmse:.4f} worse than previous {accepted_rmse:.4f}.")

        log_chunk_decision(chunk_start, chunk_end, accepted_rmse, candidate_rmse,
                           "accept" if accepted else "reject")

        chunk_start = chunk_end
        set_resume_point(chunk_start)

    print(f"\nCaught up to today ({today:%Y-%m-%d}).")


def main():
    parser = argparse.ArgumentParser(description="90-day bootstrap catch-up: 2024-01-01 -> today.")
    parser.add_argument("--model", default=config.DEFAULT_MODEL, help=f"Model name (default: {config.DEFAULT_MODEL})")
    parser.add_argument("--chunk-days", type=int, default=90, help="Chunk size in days (default: 90)")
    args = parser.parse_args()
    run(model_name=args.model, chunk_days=args.chunk_days)


if __name__ == "__main__":
    main()
