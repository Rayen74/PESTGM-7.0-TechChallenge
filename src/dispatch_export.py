"""
Grid dispatch exchange module for STEG (Société Tunisienne de l'Électricité et du Gaz).

Transforms model predictions into standardized dispatch formats (JSON and CSV)
for integration with transmission/distribution grid SCADA and EMS tools.

Key Features:
1. Multi-scale aggregation:
   - 'governorate': Individual forecasts for 24 governorates
   - 'district': Aggregated regional forecasts for 7 Tunisian grid districts
   - 'national': Nationwide aggregated solar generation
2. Multi-horizon slicing:
   - 'intra_day': Today's remaining/hourly profile (24h)
   - 'd_to_d3': Day-ahead to D+3 operational planning (96h)
   - 'full': All available forecast days (up to 16 days)
3. Capacity Scaling:
   - Models predict power normalized per 1 kWp installed capacity (W/kWp).
   - This module scales predictions linearly to custom plant or regional capacities:
     P_site = P_1kWp * Capacity_kWp (or MWp).
4. Uncertainty Quantification:
   - Each interval contains [P_lower, P_upper] and operational certainty percentage.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd

from src import config

ScaleLevel = Literal["governorate", "district", "national"]
Horizon = Literal["intra_day", "d_to_d3", "full"]


def load_latest_forecast(filepath: Path = None) -> pd.DataFrame:
    path = filepath or (config.DATA_PROCESSED_DIR / "latest_forecast.csv")
    if not path.exists():
        raise FileNotFoundError(f"No forecast file found at {path}. Run src.forecast first.")
    df = pd.read_csv(path)
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df


def prepare_dispatch_dataframe(
    forecast_df: pd.DataFrame,
    scale_level: ScaleLevel = "governorate",
    horizon: Horizon = "d_to_d3",
    capacity_kwp: float = 1.0,
    unit: Literal["kW", "MW", "W"] = "kW",
) -> pd.DataFrame:
    """
    Filters, aggregates, and scales the forecast dataframe for grid dispatch.

    Parameters
    ----------
    forecast_df : pd.DataFrame from src.forecast
    scale_level : 'governorate', 'district', or 'national'
    horizon : 'intra_day', 'd_to_d3', or 'full'
    capacity_kwp : installed capacity multiplier (default 1.0 kWp)
    unit : 'W', 'kW', or 'MW' (default 'kW')
    """
    df = forecast_df.copy()

    # Temporal horizon filter
    if horizon == "intra_day":
        df = df[df["is_intra_day"] == True].copy()
    elif horizon == "d_to_d3":
        df = df[df["is_d_to_d3"] == True].copy()

    # Unit conversion from base Watts (W per 1 kWp)
    if unit == "kW":
        unit_multiplier = (1.0 / 1000.0) * capacity_kwp
    elif unit == "MW":
        unit_multiplier = (1.0 / 1_000_000.0) * capacity_kwp
    else:  # 'W'
        unit_multiplier = 1.0 * capacity_kwp

    # Spatial aggregation
    if scale_level == "national":
        grouped = df.groupby("time").agg({
            "P": "sum",
            "P_lower": "sum",
            "P_upper": "sum",
            "certitude_pct": "mean",
            "G(i)": "mean",
            "T2m": "mean",
        }).reset_index()
        grouped["entity_name"] = "Tunisia (National Total)"
        grouped["scale_level"] = "national"
    elif scale_level == "district":
        grouped = df.groupby(["time", "district"]).agg({
            "P": "sum",
            "P_lower": "sum",
            "P_upper": "sum",
            "certitude_pct": "mean",
            "G(i)": "mean",
            "T2m": "mean",
        }).reset_index()
        grouped["entity_name"] = grouped["district"]
        grouped["scale_level"] = "district"
    else:  # governorate
        grouped = df[[
            "time", "governorate", "district", "P", "P_lower", "P_upper", "certitude_pct", "G(i)", "T2m"
        ]].copy()
        grouped["entity_name"] = grouped["governorate"]
        grouped["scale_level"] = "governorate"

    # Apply capacity scaling
    grouped["power_forecast"] = (grouped["P"] * unit_multiplier).round(3)
    grouped["power_lower_bound"] = (grouped["P_lower"] * unit_multiplier).round(3)
    grouped["power_upper_bound"] = (grouped["P_upper"] * unit_multiplier).round(3)
    grouped["certitude_pct"] = grouped["certitude_pct"].round(1)
    grouped["unit"] = unit
    grouped["capacity_kwp_basis"] = capacity_kwp

    cols_order = [
        "time", "scale_level", "entity_name", "power_forecast",
        "power_lower_bound", "power_upper_bound", "unit",
        "certitude_pct", "G(i)", "T2m", "capacity_kwp_basis"
    ]
    return grouped[[c for c in cols_order if c in grouped.columns]]


def export_dispatch_csv(dispatch_df: pd.DataFrame, out_path: Path = None) -> Path:
    out_path = out_path or (config.DATA_PROCESSED_DIR / "steg_dispatch_export.csv")
    dispatch_df.to_csv(out_path, index=False)
    return out_path


def export_dispatch_json(dispatch_df: pd.DataFrame, out_path: Path = None) -> Path:
    out_path = out_path or (config.DATA_PROCESSED_DIR / "steg_dispatch_export.json")
    records = dispatch_df.copy()
    records["timestamp_iso"] = records["time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    records = records.drop(columns=["time"], errors="ignore")

    payload = {
        "metadata": {
            "source": "Tunisia Solar Power Forecasting System",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "target_system": "STEG SCADA/EMS Grid Dispatch",
            "normalization_note": config.NORMALIZATION_NOTE,
            "record_count": len(records),
        },
        "forecasts": records.to_dict(orient="records"),
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return out_path
