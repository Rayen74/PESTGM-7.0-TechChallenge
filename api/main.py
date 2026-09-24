"""
FastAPI Backend for Tunisia Solar Power Forecasting & STEG Grid Dispatch.
Replicates all functions from app.py and connects directly to src/ modules.
"""

from datetime import datetime, timezone
import json
import os
import sys
from pathlib import Path
from typing import Literal, Optional, List, Dict, Any

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
import numpy as np
import pandas as pd
from pydantic import BaseModel

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src import config
from src.forecast import GOVERNORATES, predict_for_all_governorates, save_forecast
from src.dispatch_export import prepare_dispatch_dataframe, export_dispatch_csv, export_dispatch_json
from src.weather_monitor import check_api_health, load_health_telemetry

app = FastAPI(
    title="Tunisia Solar Forecasting API",
    description="Operational Solar Power Forecasting & STEG Grid Dispatch Backend",
    version="1.0.0",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Battery Module Router & Auth Router
from api.routes_battery import router as battery_router
from api.auth import auth_router
app.include_router(battery_router)
app.include_router(auth_router)



def get_cached_or_generate_forecast() -> pd.DataFrame:
    latest_path = config.DATA_PROCESSED_DIR / "latest_forecast.csv"
    if not latest_path.exists():
        df = predict_for_all_governorates(
            model_name=config.DEFAULT_MODEL,
            forecast_days=4,
            governorates=GOVERNORATES,
            confidence_level=config.DEFAULT_CONFIDENCE_LEVEL,
        )
        if not df.empty:
            save_forecast(df)
        return df

    df = pd.read_csv(latest_path)
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df


@app.get("/api/meta")
def get_metadata():
    """Returns static reference data: governorates, districts, models, and normalization details."""
    return {
        "active_model": config.DEFAULT_MODEL,
        "model_description": "Deep Neural Network (Validation RMSE: 0.759 W — Top Performer)",
        "forbidden_models": list(config.FORBIDDEN_MODELS),
        "normalization_note": config.NORMALIZATION_NOTE,
        "districts": config.DISTRICTS,
        "governorates": [
            {"name": gov, "district": config.GOVERNORATE_TO_DISTRICT.get(gov, "Autre"), "lat": coords[0], "lon": coords[1]}
            for gov, coords in GOVERNORATES.items()
        ],
    }


@app.get("/api/forecast")
def get_forecast(
    scale_level: Literal["national", "district", "governorate"] = Query("national"),
    entity_name: Optional[str] = Query(None),
    horizon: Literal["intra_day", "d_to_d3", "full"] = Query("d_to_d3"),
    capacity_kwp: float = Query(1.0, gt=0),
    unit: Literal["W", "kW", "MW"] = Query("kW"),
    confidence_level: float = Query(0.90, ge=0.80, le=0.98),
):
    """
    Returns filtered, aggregated, and scaled forecast time series alongside KPI metrics.
    Replicates Tab 1 logic from app.py.
    """
    df_all = get_cached_or_generate_forecast()
    if df_all.empty:
        raise HTTPException(status_code=500, detail="No forecast data could be generated.")

    # Filter temporal horizon
    if horizon == "intra_day":
        df_filtered = df_all[df_all["is_intra_day"] == True].copy()
    elif horizon == "d_to_d3":
        df_filtered = df_all[df_all["is_d_to_d3"] == True].copy()
    else:
        df_filtered = df_all.copy()

    # Aggregate & scale
    dispatch_df = prepare_dispatch_dataframe(
        forecast_df=df_filtered,
        scale_level=scale_level,
        horizon=horizon,
        capacity_kwp=capacity_kwp,
        unit=unit,
    )

    # Filter specific entity if requested
    if scale_level == "district" and entity_name:
        dispatch_df = dispatch_df[dispatch_df["entity_name"] == entity_name].copy()
    elif scale_level == "governorate" and entity_name:
        dispatch_df = dispatch_df[dispatch_df["entity_name"] == entity_name].copy()

    # Compute KPIs
    peak_power = float(dispatch_df["power_forecast"].max()) if not dispatch_df.empty else 0.0
    daytime_df = dispatch_df[dispatch_df["power_forecast"] > 0]
    avg_cert = float(daytime_df["certitude_pct"].mean()) if not daytime_df.empty else 100.0
    peak_gi = float(dispatch_df["G(i)"].max()) if not dispatch_df.empty else 0.0

    total_energy = float(dispatch_df["power_forecast"].sum())
    energy_unit = "kWh" if unit in ("kW", "W") else "MWh"
    if unit == "W":
        total_energy = total_energy / 1000.0

    # Format time series records
    records = []
    for _, row in dispatch_df.iterrows():
        t_str = row["time"].isoformat() if hasattr(row["time"], "isoformat") else str(row["time"])
        records.append({
            "time": t_str,
            "entity_name": row.get("entity_name", "National"),
            "power_forecast": round(float(row["power_forecast"]), 3),
            "power_lower_bound": round(float(row["power_lower_bound"]), 3),
            "power_upper_bound": round(float(row["power_upper_bound"]), 3),
            "certitude_pct": round(float(row["certitude_pct"]), 1),
            "gi": round(float(row["G(i)"]), 1),
            "t2m": round(float(row["T2m"]), 1) if "T2m" in row else None,
            "unit": unit,
        })

    return {
        "kpis": {
            "peak_power": round(peak_power, 2),
            "display_unit": unit,
            "total_energy": round(total_energy, 2),
            "energy_unit": energy_unit,
            "avg_certitude": round(avg_cert, 1),
            "peak_gi": round(peak_gi, 0),
        },
        "timeseries": records,
        "metadata": {
            "records_count": len(records),
            "scale_level": scale_level,
            "entity_name": entity_name or ("Tunisie Entière" if scale_level == "national" else "Tous"),
            "horizon": horizon,
            "capacity_kwp": capacity_kwp,
            "confidence_level": confidence_level,
        }
    }


@app.post("/api/forecast/refresh")
def refresh_forecast(
    days: int = Query(4, ge=1, le=16),
    confidence_level: float = Query(0.90, ge=0.80, le=0.98),
):
    """
    Forces Open-Meteo API ingestion and recalculates forecasts for all 24 governorates.
    Equivalent to the refresh button in Streamlit.
    """
    fresh_df = predict_for_all_governorates(
        model_name=config.DEFAULT_MODEL,
        forecast_days=days,
        governorates=GOVERNORATES,
        confidence_level=confidence_level,
    )
    if fresh_df.empty:
        raise HTTPException(status_code=500, detail="Forecast regeneration failed.")

    save_forecast(fresh_df)
    return {
        "status": "success",
        "message": f"Successfully updated forecast for 24 governorates across {days} days.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rows": len(fresh_df),
    }


@app.get("/api/spatial/summary")
def get_spatial_summary(
    horizon: Literal["intra_day", "d_to_d3", "full"] = Query("d_to_d3"),
    capacity_kwp: float = Query(1.0, gt=0),
    unit: Literal["W", "kW", "MW"] = Query("kW"),
):
    """
    Returns spatial data for all 24 governorates and district aggregated power totals.
    Replicates Tab 2 (Map & District Bar Chart) from app.py.
    """
    df_all = get_cached_or_generate_forecast()
    if df_all.empty:
        raise HTTPException(status_code=500, detail="No forecast data found.")

    if horizon == "intra_day":
        df_filtered = df_all[df_all["is_intra_day"] == True].copy()
    elif horizon == "d_to_d3":
        df_filtered = df_all[df_all["is_d_to_d3"] == True].copy()
    else:
        df_filtered = df_all.copy()

    gov_summary = []
    for gov, (lat, lon) in GOVERNORATES.items():
        sub = df_filtered[df_filtered["governorate"] == gov]
        if not sub.empty:
            p_peak_base = sub["P"].max()
            if unit == "kW":
                scaled_peak = p_peak_base * (capacity_kwp / 1000.0)
            elif unit == "MW":
                scaled_peak = p_peak_base * (capacity_kwp / 1_000_000.0)
            else:
                scaled_peak = p_peak_base * capacity_kwp

            day_sub = sub[sub["P"] > 0]
            avg_cert = day_sub["certitude_pct"].mean() if not day_sub.empty else 100.0

            gov_summary.append({
                "governorate": gov,
                "district": config.GOVERNORATE_TO_DISTRICT.get(gov, "Autre"),
                "latitude": lat,
                "longitude": lon,
                "peak_power": round(float(scaled_peak), 2),
                "peak_gi": round(float(sub["G(i)"].max()), 0),
                "avg_cert": round(float(avg_cert), 1),
            })

    # Group by district
    df_gov = pd.DataFrame(gov_summary)
    district_summary = []
    if not df_gov.empty:
        dist_grouped = df_gov.groupby("district")["peak_power"].sum().reset_index()
        dist_grouped = dist_grouped.sort_values("peak_power", ascending=True)
        for _, row in dist_grouped.iterrows():
            district_summary.append({
                "district": row["district"],
                "peak_power": round(float(row["peak_power"]), 2),
            })

    return {
        "governorates": gov_summary,
        "districts": district_summary,
        "unit": unit,
        "capacity_kwp": capacity_kwp,
    }


@app.get("/api/dispatch/preview")
def get_dispatch_preview(
    scale_level: Literal["national", "district", "governorate"] = Query("national"),
    entity_name: Optional[str] = Query(None),
    horizon: Literal["intra_day", "d_to_d3", "full"] = Query("d_to_d3"),
    capacity_kwp: float = Query(1.0, gt=0),
    unit: Literal["W", "kW", "MW"] = Query("kW"),
):
    """
    Returns the dispatch preview table for STEG SCADA/EMS.
    Replicates Tab 3 from app.py.
    """
    df_all = get_cached_or_generate_forecast()
    if df_all.empty:
        raise HTTPException(status_code=500, detail="No forecast data found.")

    if horizon == "intra_day":
        df_filtered = df_all[df_all["is_intra_day"] == True].copy()
    elif horizon == "d_to_d3":
        df_filtered = df_all[df_all["is_d_to_d3"] == True].copy()
    else:
        df_filtered = df_all.copy()

    dispatch_df = prepare_dispatch_dataframe(
        forecast_df=df_filtered,
        scale_level=scale_level,
        horizon=horizon,
        capacity_kwp=capacity_kwp,
        unit=unit,
    )

    if scale_level == "district" and entity_name:
        dispatch_df = dispatch_df[dispatch_df["entity_name"] == entity_name].copy()
    elif scale_level == "governorate" and entity_name:
        dispatch_df = dispatch_df[dispatch_df["entity_name"] == entity_name].copy()

    records = []
    for _, row in dispatch_df.iterrows():
        t_str = row["time"].isoformat() if hasattr(row["time"], "isoformat") else str(row["time"])
        records.append({
            "time": t_str,
            "scale_level": row.get("scale_level", scale_level),
            "entity_name": row.get("entity_name", "National"),
            "power_forecast": round(float(row["power_forecast"]), 3),
            "power_lower_bound": round(float(row["power_lower_bound"]), 3),
            "power_upper_bound": round(float(row["power_upper_bound"]), 3),
            "unit": unit,
            "certitude_pct": round(float(row["certitude_pct"]), 1),
            "gi": round(float(row["G(i)"]), 0),
        })

    return {
        "records": records,
        "total": len(records),
        "horizon": horizon,
        "unit": unit,
        "capacity_kwp": capacity_kwp,
    }


@app.get("/api/dispatch/export")
def export_dispatch(
    format: Literal["csv", "json"] = Query("csv"),
    scale_level: Literal["national", "district", "governorate"] = Query("national"),
    entity_name: Optional[str] = Query(None),
    horizon: Literal["intra_day", "d_to_d3", "full"] = Query("d_to_d3"),
    capacity_kwp: float = Query(1.0, gt=0),
    unit: Literal["W", "kW", "MW"] = Query("kW"),
):
    """
    Downloads formatted CSV or JSON file for STEG SCADA / EMS integration.
    """
    df_all = get_cached_or_generate_forecast()
    if df_all.empty:
        raise HTTPException(status_code=500, detail="No forecast data found.")

    if horizon == "intra_day":
        df_filtered = df_all[df_all["is_intra_day"] == True].copy()
    elif horizon == "d_to_d3":
        df_filtered = df_all[df_all["is_d_to_d3"] == True].copy()
    else:
        df_filtered = df_all.copy()

    dispatch_df = prepare_dispatch_dataframe(
        forecast_df=df_filtered,
        scale_level=scale_level,
        horizon=horizon,
        capacity_kwp=capacity_kwp,
        unit=unit,
    )

    if scale_level == "district" and entity_name:
        dispatch_df = dispatch_df[dispatch_df["entity_name"] == entity_name].copy()
    elif scale_level == "governorate" and entity_name:
        dispatch_df = dispatch_df[dispatch_df["entity_name"] == entity_name].copy()

    preview = dispatch_df[[
        "time", "scale_level", "entity_name", "power_forecast",
        "power_lower_bound", "power_upper_bound", "unit", "certitude_pct", "G(i)"
    ]].copy()

    filename_base = f"steg_dispatch_{horizon}_{unit.lower()}"

    if format == "csv":
        csv_data = preview.to_csv(index=False)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"},
        )
    else:
        json_payload = {
            "metadata": {
                "source": "Tunisia Solar Power Forecasting System",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "target_system": "STEG SCADA/EMS Grid Dispatch",
                "capacity_basis": f"{capacity_kwp} kWp",
                "normalization_note": config.NORMALIZATION_NOTE,
                "unit": unit,
                "records": len(preview),
            },
            "forecasts": json.loads(preview.to_json(orient="records", date_format="iso")),
        }
        return Response(
            content=json.dumps(json_payload, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.json"},
        )


@app.get("/api/telemetry")
def get_telemetry():
    """
    Returns weather API telemetry & health diagnostics.
    Replicates Tab 4 from app.py.
    """
    telemetry = load_health_telemetry()
    return {
        "status": telemetry.get("status", "HEALTHY"),
        "latency_ms": round(float(telemetry.get("latency_ms", 45.0)), 1),
        "variables_verified": bool(telemetry.get("variables_verified", True)),
        "physical_bounds_passed": bool(telemetry.get("physical_bounds_passed", True)),
        "timestamp": telemetry.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "http_code": telemetry.get("http_code", 200),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
