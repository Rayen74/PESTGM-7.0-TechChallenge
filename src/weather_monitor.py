"""
Weather API monitoring and continuous data ingestion service.

Performs:
1. Health checks on Open-Meteo Forecast API (latency, HTTP response, payload schema).
2. Physical bounds validation on incoming meteorological variables.
3. Automated continuous refresh detection: compares timestamps to ensure forecast
   stays synchronized with latest meteorological model runs (GFS / ECMWF).
4. Telemetry logging for operator dashboard.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import time
from typing import Dict, Any

import pandas as pd
import requests

from src import config
from src.forecast import OPEN_METEO_FORECAST_URL, HOURLY_VARS, GOVERNORATES, predict_for_all_governorates, save_forecast

TELEMETRY_LOG_PATH = config.DATA_PROCESSED_DIR / "weather_monitor_health.json"


# Meteorological physical limits for quality control
PHYSICAL_LIMITS = {
    "shortwave_radiation": (0.0, 1400.0),       # GHI (W/m2)
    "direct_normal_irradiance": (0.0, 1200.0),  # DNI (W/m2)
    "diffuse_radiation": (0.0, 800.0),          # DHI (W/m2)
    "temperature_2m": (-15.0, 55.0),            # T2m (deg C)
    "relative_humidity_2m": (0.0, 100.0),       # RH (%)
    "wind_speed_10m": (0.0, 60.0),              # WS (m/s)
    "pressure_msl": (900.0, 1070.0),            # MSLP (hPa)
}


def check_api_health(sample_lat: float = 36.80, sample_lon: float = 10.18) -> Dict[str, Any]:
    """
    Pings the Open-Meteo API with a lightweight query to assess connectivity,
    latency, and schema integrity.
    """
    start_time = time.time()
    params = {
        "latitude": sample_lat,
        "longitude": sample_lon,
        "hourly": ",".join(HOURLY_VARS),
        "forecast_days": 1,
        "timezone": "UTC",
    }
    status_report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "UNKNOWN",
        "latency_ms": 0.0,
        "http_code": 0,
        "variables_verified": False,
        "physical_bounds_passed": False,
        "error_message": None,
    }

    try:
        resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=15)
        status_report["http_code"] = resp.status_code
        status_report["latency_ms"] = round((time.time() - start_time) * 1000.0, 1)

        if resp.status_code == 200:
            data = resp.json().get("hourly", {})
            # Verify all expected variables are present
            missing_vars = [v for v in HOURLY_VARS if v not in data]
            if missing_vars:
                status_report["status"] = "DEGRADED"
                status_report["error_message"] = f"Missing variables: {missing_vars}"
            else:
                status_report["variables_verified"] = True

                # Check physical limits on sample data
                bounds_ok = True
                for var, (v_min, v_max) in PHYSICAL_LIMITS.items():
                    if var in data:
                        vals = [v for v in data[var] if v is not None]
                        if vals and (min(vals) < v_min or max(vals) > v_max):
                            bounds_ok = False
                            status_report["error_message"] = f"Value out of bounds for {var}: [{min(vals)}, {max(vals)}]"
                            break

                status_report["physical_bounds_passed"] = bounds_ok
                status_report["status"] = "HEALTHY" if bounds_ok else "WARNING"
        else:
            status_report["status"] = "ERROR"
            status_report["error_message"] = f"HTTP Error {resp.status_code}: {resp.text[:100]}"

    except Exception as e:
        status_report["status"] = "OFFLINE"
        status_report["error_message"] = str(e)
        status_report["latency_ms"] = round((time.time() - start_time) * 1000.0, 1)

    # Save telemetry
    save_health_telemetry(status_report)
    return status_report


def save_health_telemetry(telemetry: Dict[str, Any], path: Path = None):
    path = path or TELEMETRY_LOG_PATH
    with open(path, "w", encoding="utf-8") as f:
        json.dump(telemetry, f, indent=2)


def load_health_telemetry(path: Path = None) -> Dict[str, Any]:
    path = path or TELEMETRY_LOG_PATH
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return check_api_health()


def run_continuous_update_check(force: bool = False, forecast_days: int = 4) -> bool:
    """
    Checks if a refresh is needed (or if forced). If older than 3 hours or missing,
    fetches fresh forecasts for all governorates.
    """
    latest_path = config.DATA_PROCESSED_DIR / "latest_forecast.csv"
    needs_refresh = force

    if not latest_path.exists():
        needs_refresh = True
    else:
        mtime = datetime.fromtimestamp(latest_path.stat().st_mtime, tz=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - mtime).total_seconds() / 3600.0
        if age_hours >= 3.0:
            needs_refresh = True

    if needs_refresh:
        print(f"Triggering forecast update (force={force})...")
        health = check_api_health()
        if health["status"] in ("HEALTHY", "WARNING", "DEGRADED"):
            results = predict_for_all_governorates(
                model_name=config.DEFAULT_MODEL,
                forecast_days=forecast_days,
                governorates=GOVERNORATES,
                confidence_level=config.DEFAULT_CONFIDENCE_LEVEL,
            )
            if not results.empty:
                save_forecast(results)
                print(f"Forecast successfully refreshed at {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC.")
                return True
        else:
            print(f"Skipping refresh — Open-Meteo API is {health['status']}: {health.get('error_message')}")
            return False

    print("Forecast data is already up-to-date.")
    return False


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Check weather API health and run update if needed.")
    parser.add_argument("--force", action="store_true", help="Force forecast update regardless of age")
    parser.add_argument("--days", type=int, default=4, help="Forecast horizon in days (default: 4)")
    args = parser.parse_args()

    health = check_api_health()
    print("API Health Report:")
    print(json.dumps(health, indent=2))

    if args.force:
        run_continuous_update_check(force=True, forecast_days=args.days)
