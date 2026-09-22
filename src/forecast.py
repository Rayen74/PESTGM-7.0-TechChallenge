"""
Live forecasting pipeline with calibrated confidence intervals and multi-scale aggregation.

Fetches weather FORECAST data (today through up to 16 days) from Open-Meteo for each
governorate, computes physical features (H_sun via pvlib, G(i) via plane-of-array irradiance
transposition), executes the standard feature engineering pipeline, and produces
calibrated predictions:
    - P (Watts normalized per 1 kWp installed capacity)
    - P_lower (Lower bound of confidence interval)
    - P_upper (Upper bound of confidence interval)
    - certitude_pct (Certainty percentage 0-100%, 100% at night)
    - district (Regional grid district)
    - governorate (Governorate name)

NOTE ON NORMALIZATION:
All P values, bounds, and metrics represent generation for ONE kWp (1 kWp) of installed
capacity. To obtain generation for a specific plant or region, multiply by its total kWp.

DEFAULT MODEL:
keras_nn (Best-performing model on validation benchmark; Random Forest is strictly forbidden).

Run with:
    python -m src.forecast
    python -m src.forecast --model keras_nn --days 4
    python -m src.forecast --gov Tunis --days 3
"""

import argparse
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import requests
import pvlib

from src import config
from src.feature_engineering import (
    encode_wind_direction,
    encode_cyclical_time,
    drop_redundant_columns,
)
from src.scaling import load_feature_scaler, apply_scaler
from src.models import get_model_registry
from src.uncertainty import predict_with_intervals, get_uncertainty_calibrator

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Must match the parameters used when the PVGIS training data was generated
PANEL_TILT = 30      # degrees
PANEL_AZIMUTH = 0    # degrees, 0 = true south

HOURLY_VARS = [
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
    "shortwave_radiation",       # GHI
    "direct_normal_irradiance",  # DNI
    "diffuse_radiation",         # DHI
]

# 24 governorates: name -> (latitude, longitude)
GOVERNORATES = {
    "Tunis": (36.80, 10.18),
    "Ariana": (36.86, 10.19),
    "Ben Arous": (36.75, 10.23),
    "Manouba": (36.81, 9.87),
    "Nabeul": (36.45, 10.73),
    "Zaghouan": (36.40, 10.14),
    "Bizerte": (37.27, 9.87),
    "Beja": (36.73, 9.18),
    "Jendouba": (36.50, 8.78),
    "Le Kef": (36.17, 8.70),
    "Siliana": (36.09, 9.37),
    "Kairouan": (35.68, 10.10),
    "Kasserine": (35.17, 8.83),
    "Sidi Bouzid": (35.04, 9.48),
    "Sousse": (35.83, 10.64),
    "Monastir": (35.78, 10.83),
    "Mahdia": (35.50, 11.06),
    "Sfax": (34.74, 10.76),
    "Gafsa": (34.42, 8.78),
    "Tozeur": (33.92, 8.13),
    "Kebili": (33.70, 8.97),
    "Gabes": (33.88, 10.10),
    "Medenine": (33.35, 10.50),
    "Tataouine": (32.93, 10.45),
}


def fetch_forecast_for_gov(lat: float, lon: float, forecast_days: int = 16) -> pd.DataFrame:
    """
    One call to Open-Meteo's Forecast API for a single governorate.
    forecast_days is capped at 16 by the API itself.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARS),
        "forecast_days": min(forecast_days, 16),
        "wind_speed_unit": "ms",   # match PVGIS's WS10m units (m/s), NOT the km/h default
        "timezone": "UTC",
    }
    resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()["hourly"]

    df = pd.DataFrame(data)
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df


def compute_h_sun_and_gi(df: pd.DataFrame, lat: float, lon: float) -> pd.DataFrame:
    """
    Adds H_sun (solar elevation, pure astronomy) and G(i) (irradiance on
    the tilted panel plane) to a dataframe that already has GHI/DNI/DHI
    forecast columns from Open-Meteo.
    """
    df = df.copy()

    solpos = pvlib.solarposition.get_solarposition(
        time=df["time"], latitude=lat, longitude=lon
    )
    df["H_sun"] = solpos["elevation"].values
    solar_zenith = solpos["apparent_zenith"].values
    solar_azimuth = solpos["azimuth"].values

    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=PANEL_TILT,
        surface_azimuth=PANEL_AZIMUTH,
        solar_zenith=solar_zenith,
        solar_azimuth=solar_azimuth,
        dni=df["direct_normal_irradiance"].values,
        ghi=df["shortwave_radiation"].values,
        dhi=df["diffuse_radiation"].values,
    )
    poa_global = poa["poa_global"]
    df["G(i)"] = poa_global.values if hasattr(poa_global, "values") else poa_global
    # Ensure physical lower bound
    df["G(i)"] = np.maximum(0.0, df["G(i)"].fillna(0.0))
    return df


def raw_weather_to_engineered_features(raw: pd.DataFrame, gov_name: str, lat: float, lon: float) -> pd.DataFrame:
    """
    Takes a weather dataframe already containing H_sun/G(i), renames fields to match
    training column names, splits the timestamp, and executes the exact feature engineering
    used in training.
    """
    df = pd.DataFrame({
        "time": raw["time"],
        "latitude": lat,
        "longitude": lon,
        "T2m": raw["temperature_2m"],
        "WS10m": raw["wind_speed_10m"],
        "wind_direction_10m": raw["wind_direction_10m"],
        "relative_humidity_2m": raw["relative_humidity_2m"],
        "dew_point_2m": raw["dew_point_2m"],
        "precipitation": raw["precipitation"],
        "cloud_cover_low": raw["cloud_cover_low"],
        "cloud_cover_mid": raw["cloud_cover_mid"],
        "cloud_cover_high": raw["cloud_cover_high"],
        "pressure_msl": raw["pressure_msl"],
        "H_sun": raw["H_sun"],
        "G(i)": raw["G(i)"],
    })

    df["year"] = df["time"].dt.year
    df["month"] = df["time"].dt.month
    df["day"] = df["time"].dt.day
    df["hour"] = df["time"].dt.hour

    df = encode_wind_direction(df)
    df = encode_cyclical_time(df)
    df = drop_redundant_columns(df)

    df["governorate"] = gov_name
    df["district"] = config.GOVERNORATE_TO_DISTRICT.get(gov_name, "Autre")
    return df


def build_features_for_gov(gov_name: str, lat: float, lon: float, forecast_days: int) -> pd.DataFrame:
    """Fetches the live forecast and engineers features from it."""
    raw = fetch_forecast_for_gov(lat, lon, forecast_days=forecast_days)
    raw = compute_h_sun_and_gi(raw, lat, lon)
    return raw_weather_to_engineered_features(raw, gov_name, lat, lon)


def load_model(model_name: str = config.DEFAULT_MODEL):
    """
    Loads model, enforcing project policy (keras_nn required; random_forest banned).
    """
    clean_name = model_name.strip().lower()
    if clean_name in config.FORBIDDEN_MODELS or "forest" in clean_name:
        raise ValueError(
            f"Model '{model_name}' is strictly forbidden per project rules. "
            f"Use the best model '{config.DEFAULT_MODEL}'."
        )

    registry = get_model_registry()
    if clean_name not in registry:
        raise ValueError(f"Unknown model '{model_name}'. Choices: {list(registry.keys())}")

    needs_scaling = registry[clean_name]["needs_scaling"]
    model_path = config.MODELS_DIR / f"{clean_name}.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at {model_path}. Please train it first.")

    model = joblib.load(model_path)
    return model, needs_scaling


def predict_for_all_governorates(
    model_name: str = config.DEFAULT_MODEL,
    forecast_days: int = 4,
    governorates: dict = None,
    confidence_level: float = config.DEFAULT_CONFIDENCE_LEVEL,
) -> pd.DataFrame:
    """
    Runs the live pipeline for specified governorates and returns:
    [time, governorate, district, P, P_lower, P_upper, certitude_pct, G(i), T2m, ...]

    All P values represent Watts per 1 kWp installed capacity.
    """
    governorates = governorates or GOVERNORATES
    model, needs_scaling = load_model(model_name)
    scaler = load_feature_scaler() if needs_scaling else None
    calibrator = get_uncertainty_calibrator()
    calibrator.confidence_level = confidence_level

    all_results = []
    total_govs = len(governorates)

    for idx, (gov_name, (lat, lon)) in enumerate(governorates.items(), 1):
        print(f"[{idx}/{total_govs}] Fetching + predicting: {gov_name} ...")
        try:
            feats = build_features_for_gov(gov_name, lat, lon, forecast_days)
        except requests.RequestException as e:
            print(f"  WARNING: failed to fetch forecast for {gov_name}: {e}")
            continue

        if scaler is not None and hasattr(scaler, "feature_names_in_"):
            feature_cols = list(scaler.feature_names_in_)
        elif hasattr(model, "feature_names_in_"):
            feature_cols = list(model.feature_names_in_)
        else:
            meta_cols = ["time", "governorate", "district", "date", "days_ahead", "is_intra_day", "is_d_to_d3", "P_source", config.TARGET]
            feature_cols = [c for c in feats.columns if c not in meta_cols]

        X = feats[feature_cols].copy()

        if needs_scaling and scaler is not None:
            X_model_in = apply_scaler(scaler, X)
        else:
            X_model_in = X

        # Predict with calibrated confidence intervals & certitude
        interval_df = predict_with_intervals(
            model=model,
            X_features=X_model_in,
            raw_weather_df=feats,
            confidence_level=confidence_level,
            calibrator=calibrator,
        )

        # Merge metadata, predictions, and intervals
        res = pd.concat([
            feats[["time", "governorate", "district", "G(i)", "T2m", "WS10m"]].reset_index(drop=True),
            interval_df.reset_index(drop=True)
        ], axis=1)

        # Add temporal horizon categories: Intra-day (today) vs D to D+3
        now_utc = datetime.now(timezone.utc)
        today_date = now_utc.date()
        res["date"] = res["time"].dt.date
        res["days_ahead"] = (res["date"] - today_date).apply(lambda d: d.days)
        res["is_intra_day"] = res["days_ahead"] == 0
        res["is_d_to_d3"] = res["days_ahead"].between(0, 3)

        all_results.append(res)
        time.sleep(0.15)  # Respect free API rate limits

    if not all_results:
        return pd.DataFrame()

    full_df = pd.concat(all_results, ignore_index=True)
    return full_df


def save_forecast(results_df: pd.DataFrame) -> tuple[Path, Path]:
    """
    Saves results to both a timestamped file and the fixed latest_forecast.csv
    file used by the dashboard and monitoring system.
    """
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    timestamped_path = config.DATA_PROCESSED_DIR / f"forecast_{now_str}.csv"
    latest_path = config.DATA_PROCESSED_DIR / "latest_forecast.csv"

    results_df.to_csv(timestamped_path, index=False)
    results_df.to_csv(latest_path, index=False)
    return timestamped_path, latest_path


def main():
    parser = argparse.ArgumentParser(description="Live P forecast with calibrated confidence intervals (1 kWp normalized).")
    parser.add_argument("--model", default=config.DEFAULT_MODEL, help=f"Model name (default: {config.DEFAULT_MODEL}; Random Forest forbidden)")
    parser.add_argument("--days", type=int, default=4, help="Forecast horizon in days (default: 4 for D to D+3; max 16)")
    parser.add_argument("--gov", default=None, help="Single governorate name, e.g. Tunis (default: all 24)")
    parser.add_argument("--confidence", type=float, default=config.DEFAULT_CONFIDENCE_LEVEL, help="Confidence interval level, e.g. 0.90 for 90%")
    args = parser.parse_args()

    govs = {args.gov: GOVERNORATES[args.gov]} if args.gov else GOVERNORATES

    print(f"Starting forecast pipeline using model: '{args.model}' (Coverage: {int(args.confidence*100)}% CI)")
    print(f"Capacity normalization: {config.NORMALIZATION_NOTE}\n")

    results = predict_for_all_governorates(
        model_name=args.model,
        forecast_days=args.days,
        governorates=govs,
        confidence_level=args.confidence,
    )

    if results.empty:
        print("ERROR: No forecast rows generated.")
        return

    ts_path, latest_path = save_forecast(results)
    print(f"\nSuccessfully generated {len(results):,} forecast rows.")
    print(f"Saved latest forecast to: {latest_path}")
    print(f"Saved timestamped archive to: {ts_path}\n")

    # Sample preview
    preview_cols = ["time", "governorate", "district", "P", "P_lower", "P_upper", "certitude_pct", "G(i)"]
    print("Sample preview (first 10 daytime rows):")
    daytime = results[results["P"] > 0]
    sample = daytime[preview_cols].head(10) if not daytime.empty else results[preview_cols].head(10)
    print(sample.to_string(index=False))


if __name__ == "__main__":
    main()
