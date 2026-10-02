"""Provisional weather-aware operational risk assessment."""
from __future__ import annotations

import json
import math
import os
import time
from threading import Lock
from typing import Any, Optional
from urllib.parse import urlencode
from urllib.request import urlopen

_weather_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
_weather_lock = Lock()
_WEATHER_TTL_SECONDS = 600

ACTIVE_INSTALLATION_STATUS = "ACTIVE"


def is_active_battery_status(status: Optional[str]) -> bool:
    """Only a commissioned, active installation enables citizen risk guidance."""
    return status == ACTIVE_INSTALLATION_STATUS


def _weather(lat: Optional[float], lon: Optional[float]) -> dict[str, Any]:
    key = os.getenv("OPEN_WEATHER_API_KEY", "").strip()
    if not key or lat is None or lon is None:
        return {"available": False, "factors": [], "message": "Weather risk data unavailable"}
    cache_key = (round(float(lat), 3), round(float(lon), 3))
    now = time.time()
    with _weather_lock:
        cached = _weather_cache.get(cache_key)
        if cached and now - cached[0] < _WEATHER_TTL_SECONDS:
            return cached[1]
    try:
        query = urlencode({"lat": lat, "lon": lon, "appid": key, "units": "metric"})
        with urlopen(f"https://api.openweathermap.org/data/2.5/forecast?{query}", timeout=4) as response:
            payload = json.loads(response.read().decode("utf-8"))
        rows = payload.get("list") or []
        clouds = [float((row.get("clouds") or {}).get("all", 0)) for row in rows[:8]]
        rain = [float((row.get("rain") or {}).get("3h", 0)) for row in rows[:8]]
        wind = [float((row.get("wind") or {}).get("speed", 0)) for row in rows[:8]]
        cloud_range = max(clouds) - min(clouds) if clouds else 0
        wind_range = max(wind) - min(wind) if wind else 0
        rain_total = sum(rain)
        score = cloud_range / 100 + min(wind_range / 10, 1) + min(rain_total / 10, 1)
        variability = "HIGH" if score >= 1.5 else "MEDIUM" if score >= 0.7 else "LOW"
        factors = []
        if max(clouds or [0]) >= 70: factors.append("High cloud cover may reduce production")
        if rain_total > 0: factors.append("Rain may reduce production")
        if max(wind or [0]) >= 10: factors.append("Strong or changing wind adds uncertainty")
        if variability != "LOW": factors.append("Weather conditions are variable")
        result = {"available": True, "cloud_cover_pct": round(sum(clouds) / len(clouds), 1) if clouds else None,
                  "rain_mm": round(rain_total, 1), "wind_mps": round(max(wind or [0]), 1),
                  "variability": variability, "factors": factors, "source": "OpenWeather"}
    except Exception:
        result = {"available": False, "factors": [], "message": "Weather risk data unavailable"}
    with _weather_lock:
        _weather_cache[cache_key] = (now, result)
    return result


def assess_risk(expected: float, lower: float, upper: float, certitude_pct: float,
                latitude: Optional[float] = None, longitude: Optional[float] = None) -> dict[str, Any]:
    expected, lower, upper = float(expected), float(lower), float(upper)
    certitude = max(0.0, min(100.0, float(certitude_pct)))
    if not all(math.isfinite(value) for value in (expected, lower, upper, certitude)):
        raise ValueError("Forecast values must be finite")
    width_ratio = max(0.0, upper - lower) / max(abs(expected), 1.0)
    weather = _weather(latitude, longitude)
    weather_var = weather.get("variability")
    if certitude < 50 or width_ratio >= 0.75 or weather_var == "HIGH": level, reserve = "HIGH", 30
    elif certitude < 80 or width_ratio >= 0.35 or weather_var == "MEDIUM": level, reserve = "MEDIUM", 15
    else: level, reserve = "LOW", 0
    reason = {"LOW": "The interval is narrow and the forecast is stable.",
              "MEDIUM": "The interval or weather conditions add uncertainty.",
              "HIGH": "The interval is wide or weather conditions are highly variable."}[level]
    return {"risk_level": level, "risk_reason": reason, "expected_value": expected,
            "lower_value": lower, "upper_value": upper, "certitude_pct": round(certitude, 1),
            "conservative_value": lower, "possible_shortfall": round(max(expected - lower, 0.0), 3),
            "recommended_grid_reserve_pct": reserve,
            "dispatch_recommendation": ("Follow the expected forecast." if level == "LOW" else
                "Plan conservatively and preserve reserve capacity." if level == "MEDIUM" else
                "Plan near the lower bound and require human review."),
            "battery_reserve_advice": ("Keep your normal reserve." if level == "LOW" else
                "Keep extra battery reserve because the forecast may move." if level == "MEDIUM" else
                "Keep a high reserve and avoid relying on the upper bound."),
            "charging_guidance": "Charge when solar production is available and the battery is below its reserve.",
            "discharging_guidance": ("Use stored energy normally." if level == "LOW" else
                "Use stored energy carefully and protect the recommended reserve."),
            "human_review_required": level == "HIGH", "weather": weather, "provisional": True}
