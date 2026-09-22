"""
Periodic retraining pipeline.

This is intentionally SEPARATE from forecast.py:
    - forecast.py runs often (e.g. daily), is fast, and only calls
      model.predict() using whatever is currently saved in outputs/models/.
    - retrain.py runs rarely (every 30 days), is slow (retrains on the
      full accumulated dataset), and produces a NEW saved model that
      forecast.py will pick up on its next run.

WHERE THE "NEW GROUND TRUTH" COMES FROM
-----------------------------------------
Open-Meteo's Forecast API only gives you the future — it cannot tell you
what P actually was 30 days ago. To grow the training set with real
observations, this script pulls the same window from Open-Meteo's
HISTORICAL API (already used to build the original training set) plus
newly-available PVGIS data if it has been updated for that period. If
real STEG production data becomes available, that is the preferred
ground truth and should replace the PVGIS-derived P for those rows —
see the note in append_new_training_window() below.

WHAT THIS SCRIPT DOES, STEP BY STEP
--------------------------------------
1. Determine the new date window (last retrain date -> today).
2. Pull historical weather + recompute H_sun/G(i) for that window.
3. Append it to the existing training dataset on disk.
4. Re-run the full train.py pipeline on the GROWN dataset.
5. Compare the new model's validation metrics to the previous model's
   (loaded from outputs/metrics/model_comparison.csv) before overwriting
   it, so a bad retrain doesn't silently replace a good model.

Run with:
    python -m src.retrain --model random_forest

Intended to be scheduled every 30 days (see docs/SCHEDULING.md for how
to set this up with Windows Task Scheduler or cron).
"""

import argparse
import shutil
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests

from src import config
from src.forecast import GOVERNORATES, compute_h_sun_and_gi
from src.train import main as run_training

OPEN_METEO_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"

HISTORICAL_HOURLY_VARS = [
    "temperature_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "pressure_msl",
    "shortwave_radiation",
    "direct_normal_irradiance",
    "diffuse_radiation",
]

LAST_RETRAIN_MARKER = config.DATA_PROCESSED_DIR / "last_retrain_date.txt"


def get_last_retrain_date() -> datetime:
    """Reads the last retrain date, or defaults to 30 days ago on first run."""
    if LAST_RETRAIN_MARKER.exists():
        text = LAST_RETRAIN_MARKER.read_text().strip()
        return datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - timedelta(days=30)


def set_last_retrain_date(dt: datetime):
    LAST_RETRAIN_MARKER.write_text(dt.strftime("%Y-%m-%d"))


def fetch_historical_window(lat: float, lon: float, start: datetime, end: datetime) -> pd.DataFrame:
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "hourly": ",".join(HISTORICAL_HOURLY_VARS),
        "wind_speed_unit": "ms",
        "timezone": "UTC",
    }
    resp = requests.get(OPEN_METEO_HISTORICAL_URL, params=params, timeout=60)
    resp.raise_for_status()
    data = resp.json()["hourly"]
    df = pd.DataFrame(data)
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df


def fetch_real_p_for_window(gov_name: str, lat: float, lon: float,
                              start: datetime, end: datetime) -> pd.Series:
    """
    Placeholder for the REAL ground-truth P for this window.

    Priority order (see docs/DATA_SOURCES.md for the same reasoning):
      1. STEG production data (smart meters / SCADA), if you have access
         to it — this is the ONLY source of true measured P.
      2. PVGIS, once it has been updated to cover this window (PVGIS
         typically lags by about a year, so this will usually be empty
         for a "last 30 days" window).
      3. If neither is available yet, this window cannot be added as new
         *ground truth* — you can still add the weather features to a
         holding area, but do not fabricate a P value for it.

    This function currently returns None to make that limitation explicit
    rather than silently inventing data. Replace this with a real STEG
    data pull as soon as that connection exists.
    """
    return None


def append_new_training_window(governorates: dict = None) -> bool:
    """
    Pulls the new window's weather + (if available) real P, engineers the
    same H_sun/G(i)/cyclical features, and appends to the raw training
    CSV. Returns True if new labeled rows were actually added.
    """
    governorates = governorates or GOVERNORATES
    start = get_last_retrain_date()
    end = datetime.now(timezone.utc)

    if (end - start).days < 1:
        print("Less than a day of new data available — skipping this window.")
        return False

    print(f"Pulling new training window: {start:%Y-%m-%d} -> {end:%Y-%m-%d}")

    new_rows = []
    for gov_name, (lat, lon) in governorates.items():
        real_p = fetch_real_p_for_window(gov_name, lat, lon, start, end)
        if real_p is None:
            continue  # no ground truth for this governorate/window yet

        weather = fetch_historical_window(lat, lon, start, end)
        weather = compute_h_sun_and_gi(weather, lat, lon)
        weather["P"] = real_p
        weather["location"] = gov_name
        weather["latitude"] = lat
        weather["longitude"] = lon
        new_rows.append(weather)

    if not new_rows:
        print("No real ground-truth P available for this window yet — "
              "nothing added. See fetch_real_p_for_window() docstring.")
        return False

    new_df = pd.concat(new_rows, ignore_index=True)
    new_df = new_df.rename(columns={
        "temperature_2m": "T2m", "wind_speed_10m": "WS10m",
    })

    # The raw CSV's schema already has year/month/day/hour split out (not a
    # single 'time' column) and a total 'cloud_cover' field — match that
    # exactly, or the concat below will silently misalign columns.
    new_df["year"] = new_df["time"].dt.year
    new_df["month"] = new_df["time"].dt.month
    new_df["day"] = new_df["time"].dt.day
    new_df["hour"] = new_df["time"].dt.hour
    # Open-Meteo's forecast/historical APIs don't expose the same "total
    # cloud cover" field PVGIS/Open-Meteo's older pull used; approximate it
    # as the max of the three layers. This column is dropped during feature
    # engineering anyway (see feature_engineering.drop_redundant_columns),
    # so the approximation only matters if you inspect the raw file directly.
    new_df["cloud_cover"] = new_df[["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"]].max(axis=1)

    raw_schema_cols = [
        "year", "month", "day", "hour", "location", "latitude", "longitude",
        "G(i)", "H_sun", "T2m", "WS10m", "relative_humidity_2m", "cloud_cover",
        "wind_direction_10m", "pressure_msl", "precipitation", "dew_point_2m",
        "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "P",
    ]
    new_df = new_df[raw_schema_cols]

    existing = pd.read_csv(config.RAW_CSV_PATH)
    combined = pd.concat([existing, new_df], ignore_index=True)
    combined.to_csv(config.RAW_CSV_PATH, index=False)
    print(f"Appended {len(new_df):,} new labeled rows. Dataset is now {len(combined):,} rows.")
    return True


def retrain_if_improved(model_name: str = config.DEFAULT_MODEL):
    """
    Backs up the current model + metrics, retrains on the grown dataset,
    and only keeps the new model if it's at least as good on validation
    as the one it's replacing.
    """
    if model_name in config.FORBIDDEN_MODELS or "forest" in model_name:
        raise ValueError(f"Model '{model_name}' is forbidden. Use '{config.DEFAULT_MODEL}'.")

    metrics_path = config.METRICS_DIR / "model_comparison.csv"
    model_path = config.MODELS_DIR / f"{model_name}.joblib"

    old_rmse = None
    if metrics_path.exists():
        old_metrics = pd.read_csv(metrics_path)
        row = old_metrics[old_metrics["model"] == model_name]
        if not row.empty:
            old_rmse = row["RMSE"].iloc[0]

    backup_path = model_path.with_suffix(".joblib.bak")
    if model_path.exists():
        shutil.copy(model_path, backup_path)

    print("Retraining on the grown dataset...")
    results_df = run_training()

    new_row = results_df[results_df["model"] == model_name]
    new_rmse = new_row["RMSE"].iloc[0] if not new_row.empty else None

    if old_rmse is not None and new_rmse is not None and new_rmse > old_rmse * 1.05:
        print(f"New RMSE ({new_rmse:.3f}) is notably worse than the previous "
              f"model's ({old_rmse:.3f}). Restoring the previous model.")
        shutil.copy(backup_path, model_path)
    else:
        print(f"New model kept (RMSE {new_rmse} vs previous {old_rmse}).")


def main():
    parser = argparse.ArgumentParser(description="Append new data and retrain every ~30 days (1 kWp normalized).")
    parser.add_argument("--model", default=config.DEFAULT_MODEL, help=f"Model name to evaluate/keep (default: {config.DEFAULT_MODEL})")
    parser.add_argument("--force", action="store_true", help="Retrain even if no new labeled data was added")
    args = parser.parse_args()

    if args.model in config.FORBIDDEN_MODELS or "forest" in args.model:
        raise ValueError(f"Model '{args.model}' is forbidden. Use '{config.DEFAULT_MODEL}'.")

    added = append_new_training_window()
    if added or args.force:
        retrain_if_improved(args.model)
        set_last_retrain_date(datetime.now(timezone.utc))
    else:
        print("Skipping retrain — no new labeled data and --force not set.")


if __name__ == "__main__":
    main()
