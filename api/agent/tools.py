"""
Deterministic Python Tools for the Battery Technical AI Agent.
Follows PESTGM 7.0 specification:
- get_installation()
- check_compatibility()
- get_pv_prediction()
- simulate_battery()
- compare_batteries()

These tools are 100% deterministic, numerical, and grounded in physical and electrical rules.
"""

from typing import Dict, Any, List, Optional, Tuple, Callable
import functools
import inspect
import json
import pandas as pd
from api.database import query_one, query_all
from api.battery_engine import (
    generate_hourly_consumption,
    check_battery_compatibility,
    simulate_battery_dispatch,
)
from src import config
from src.forecast import GOVERNORATES, predict_for_all_governorates, save_forecast

# ---------------------------------------------------------------------------
# Tool Registry & @tool Decorator (Standard Function Calling Spec)
# ---------------------------------------------------------------------------
TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {}


def tool(name: Optional[str] = None, description: Optional[str] = None):
    """
    Decorator that registers a Python function as an Agent Tool with JSON Schema metadata.
    Enables autonomous Tool Calling / Function Calling by Ollama/OpenAI/LangChain style agents.
    """
    def decorator(func: Callable):
        tool_name = name or func.__name__
        tool_desc = (description or func.__doc__ or "").strip()
        
        # Build parameter schema via inspect
        sig = inspect.signature(func)
        properties = {}
        required = []
        
        for param_name, param in sig.parameters.items():
            if param_name in ("conn", "self"):
                continue  # internal injected context, not exposed to LLM
            
            p_type = "string"
            if param.annotation in (int, float):
                p_type = "number"
            elif param.annotation == bool:
                p_type = "boolean"
            elif param.annotation in (list, List):
                p_type = "array"
            elif param.annotation in (dict, Dict):
                p_type = "object"

            properties[param_name] = {
                "type": p_type,
                "description": f"Parameter {param_name}"
            }
            if param.default == inspect.Parameter.empty:
                required.append(param_name)

        tool_schema = {
            "type": "function",
            "function": {
                "name": tool_name,
                "description": tool_desc,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required
                }
            }
        }

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        wrapper.tool_name = tool_name
        wrapper.tool_schema = tool_schema
        
        TOOL_REGISTRY[tool_name] = {
            "name": tool_name,
            "description": tool_desc,
            "func": wrapper,
            "schema": tool_schema
        }
        return wrapper

    return decorator


def get_registered_tools_schemas() -> List[Dict[str, Any]]:
    """Returns the OpenAI/Ollama compatible function calling schemas for all registered tools."""
    return [t["schema"] for t in TOOL_REGISTRY.values()]


@tool(name="get_installation", description="Récupère le profil PV complet du citoyen, caractéristiques onduleur, tension de bus et contrat STEG.")
def tool_get_installation(conn: Any, user_id: int) -> Optional[Dict[str, Any]]:
    """
    Tool: get_installation
    Retrieves the user's PV profile, contract details, and electrical constraints.
    """
    user = query_one(conn, "SELECT id, email, full_name, steg_contract_no FROM users WHERE id = %s", (user_id,))
    if not user:
        return None

    profile = query_one(conn, "SELECT * FROM pv_profiles WHERE user_id = %s", (user_id,))
    if not profile:
        return None

    return {
        "user_id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "steg_contract_no": user["steg_contract_no"],
        "pv_capacity_kwp": profile["pv_capacity_kwp"],
        "governorate": profile["governorate"],
        "inverter_brand": profile["inverter_brand"],
        "inverter_model": profile["inverter_model"],
        "inverter_type": profile["inverter_type"],
        "inverter_rated_power_kw": profile["inverter_rated_power_kw"],
        "battery_bus_type": profile["battery_bus_type"],
        "consumption_archetype": profile["consumption_archetype"],
        "annual_consumption_kwh": profile.get("annual_consumption_kwh", 4500.0),
    }


@tool(name="check_compatibility", description="Vérifie la compatibilité physique, électrique et de protocole BMS entre l'onduleur et la batterie.")
def tool_check_compatibility(pv_profile: Dict[str, Any], battery: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool: check_compatibility
    Validates physical, electrical, and communication compatibility between inverter and battery.
    """
    is_compatible, notes = check_battery_compatibility(pv_profile, battery)
    
    # Calculate electrical sizing ratio (Storage kWh / Inverter kW)
    inverter_kw = float(pv_profile.get("inverter_rated_power_kw") or 5.0)
    battery_kwh = float(battery.get("usable_capacity_kwh") or 5.0)
    ratio = round(battery_kwh / inverter_kw, 2) if inverter_kw > 0 else 1.0

    return {
        "is_compatible": is_compatible,
        "notes": notes,
        "inverter_rated_power_kw": inverter_kw,
        "battery_usable_capacity_kwh": battery_kwh,
        "battery_voltage_type": battery.get("voltage_type"),
        "inverter_bus_type": pv_profile.get("battery_bus_type"),
        "sizing_ratio_storage_to_inverter": ratio,
        "steg_certified": bool(battery.get("steg_certified", True)),
    }


@tool(name="get_pv_prediction", description="Extrait la prédiction de production solaire heure par heure (kW) via le modèle CatBoost pour un gouvernorat donné.")
def tool_get_pv_prediction(governorate: str, capacity_kwp: float, hours: int = 96) -> List[float]:
    """
    Tool: get_pv_prediction
    Retrieves the solar generation series (kW) from the CatBoost model.
    """
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
    else:
        df = pd.read_csv(latest_path)

    sub = df[df["governorate"] == governorate]
    if sub.empty:
        sub = df[df["governorate"] == "Tunis"]

    if sub.empty:
        return [0.0] * hours

    p_series_kw = (sub["P"].values * (capacity_kwp / 1000.0)).tolist()
    if len(p_series_kw) < hours:
        p_series_kw = (p_series_kw * 3)[:hours]
    return [round(float(v), 3) for v in p_series_kw[:hours]]


@tool(name="simulate_battery", description="Exécute la simulation physique heure par heure du dispatch batterie (SOC, autoconsommation, autonomie, réseau).")
def tool_simulate_battery(
    pv_series: List[float],
    consumption_series: List[float],
    battery: Dict[str, Any],
    initial_soc_pct: float = 50.0
) -> Dict[str, Any]:
    """
    Tool: simulate_battery
    Executes deterministic hour-by-hour physical battery dispatch simulation.
    """
    return simulate_battery_dispatch(
        pv_series_kw=pv_series,
        consumption_series_kw=consumption_series,
        battery=battery,
        initial_soc_pct=initial_soc_pct,
    )


@tool(name="compare_batteries", description="Simule et classe comparativement toutes les batteries compatibles du catalogue selon le taux d'autonomie.")
def tool_compare_batteries(
    conn: Any,
    pv_profile: Dict[str, Any],
    pv_series: List[float],
    consumption_series: List[float],
    battery_ids: Optional[List[int]] = None
) -> List[Dict[str, Any]]:
    """
    Tool: compare_batteries
    Simulates and ranks multiple candidate batteries from the catalog.
    """
    if battery_ids:
        placeholders = ",".join(["%s"] * len(battery_ids))
        batteries = query_all(conn, f"SELECT * FROM battery_catalog WHERE id IN ({placeholders})", tuple(battery_ids))
    else:
        # Load all certified batteries matching bus voltage
        bus = pv_profile.get("battery_bus_type", "LV_48V")
        batteries = query_all(conn, "SELECT * FROM battery_catalog WHERE voltage_type = %s", (bus,))

    results = []
    for b in batteries:
        compat_info = tool_check_compatibility(pv_profile, b)
        sim = tool_simulate_battery(pv_series, consumption_series, b, initial_soc_pct=50.0)
        kpis = sim.get("kpis", {})
        results.append({
            "battery_id": b["id"],
            "brand": b["brand"],
            "model": b["model"],
            "usable_capacity_kwh": b["usable_capacity_kwh"],
            "voltage_type": b["voltage_type"],
            "is_compatible": compat_info["is_compatible"],
            "self_consumption_pct": kpis.get("self_consumption_pct", 0.0),
            "self_sufficiency_pct": kpis.get("self_sufficiency_pct", 0.0),
            "curtailment_prevented_kwh": kpis.get("curtailment_prevented_kwh", 0.0),
            "backup_autonomy_hours": round(b["usable_capacity_kwh"] / max(0.5, (pv_profile.get("annual_consumption_kwh", 4500) / 8760.0)), 1),
        })

    # Sort by self-sufficiency descending
    results.sort(key=lambda x: x["self_sufficiency_pct"], reverse=True)
    return results
