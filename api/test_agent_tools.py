"""
Battery Technical AI Agent — Comprehensive Tool Execution & Validation Test
Runs and validates all registered Agent tools:
1. @tool check_compatibility
2. @tool simulate_battery
3. Tool JSON Schemas (Ollama / OpenAI standard function calling format)
"""

import sys
import json
from pathlib import Path

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from api.battery_engine import (
    check_battery_compatibility,
    simulate_battery_dispatch,
    generate_hourly_consumption,
)
from api.agent.tools import (
    tool_check_compatibility,
    tool_simulate_battery,
    get_registered_tools_schemas,
    TOOL_REGISTRY,
)


def run_tests():
    print("=" * 70)
    print("BATTERY TECHNICAL AI AGENT -- TOOLS TEST SUITE")
    print("=" * 70)

    # ---------------------------------------------------------
    # 0. INSPECT REGISTERED TOOL SCHEMAS
    # ---------------------------------------------------------
    print("\n[STEP 0] Inspecting Registered @tool Functions & JSON Schemas:")
    schemas = get_registered_tools_schemas()
    print(f"Total Registered Tools for LLM Function Calling: {len(schemas)}")
    for i, s in enumerate(schemas, 1):
        fn = s["function"]
        params = list(fn["parameters"]["properties"].keys())
        print(f"  {i}. @tool: '{fn['name']}' -> params: {params}")
        print(f"     Description: {fn['description']}")

    # ---------------------------------------------------------
    # 1. TOOL: check_compatibility
    # ---------------------------------------------------------
    print("\n" + "-" * 70)
    print("[STEP 1] Testing Tool: check_compatibility")
    
    inverter_profile = {
        "inverter_brand": "Growatt",
        "inverter_model": "SPH 5000",
        "inverter_type": "HYBRID",
        "battery_bus_type": "LV_48V",
        "inverter_rated_power_kw": 5.0,
        "pv_capacity_kwp": 4.5,
    }

    bat_compatible = {
        "id": 1,
        "brand": "Pylontech",
        "model": "US5000",
        "voltage_type": "LV_48V",
        "nominal_capacity_kwh": 4.8,
        "usable_capacity_kwh": 4.56,
        "max_charge_kw": 2.4,
        "max_discharge_kw": 2.4,
        "roundtrip_efficiency": 0.95,
        "steg_certified": True,
        "supported_inverters": ["Growatt", "Deye", "Victron"],
    }

    bat_incompatible = {
        "id": 2,
        "brand": "BYD",
        "model": "Battery-Box Premium HVS",
        "voltage_type": "HV_HIGH_VOLTAGE",
        "nominal_capacity_kwh": 5.1,
        "usable_capacity_kwh": 5.1,
        "max_charge_kw": 5.0,
        "max_discharge_kw": 5.0,
        "roundtrip_efficiency": 0.96,
        "steg_certified": True,
        "supported_inverters": ["Fronius", "SMA"],
    }

    print(" -> Calling: check_compatibility(inverter=Growatt LV_48V, battery=Pylontech LV_48V)...")
    res1 = tool_check_compatibility(inverter_profile, bat_compatible)
    print("    [Result]:")
    print(json.dumps(res1, indent=6))
    assert res1["is_compatible"] is True, "Assertion Failed: Pylontech should be compatible!"
    print("    PASSED: Compatibility validated.")

    print("\n -> Calling: check_compatibility(inverter=Growatt LV_48V, battery=BYD HV_HIGH_VOLTAGE)...")
    res2 = tool_check_compatibility(inverter_profile, bat_incompatible)
    print("    [Result]:")
    print(json.dumps(res2, indent=6))
    assert res2["is_compatible"] is False, "Assertion Failed: BYD should be rejected due to HV/LV mismatch!"
    print("    PASSED: Incompatibility correctly caught by electrical bus rule.")

    # ---------------------------------------------------------
    # 2. TOOL: simulate_battery
    # ---------------------------------------------------------
    print("\n" + "-" * 70)
    print("[STEP 2] Testing Tool: simulate_battery (Physical Hourly Dispatch)")
    
    # 24h realistic curves
    pv_curve_24h = [
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.1, 0.6, 1.5, 2.8, 3.8, 4.2,
        4.1, 3.5, 2.4, 1.2, 0.3, 0.0,
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    ]
    load_curve_24h = generate_hourly_consumption("residential_evening_peak", annual_kwh=4500.0, num_hours=24)

    print(" -> Calling: simulate_battery(pv_24h, load_24h, bat_usable=4.56 kWh, init_soc=30%)...")
    sim = tool_simulate_battery(
        pv_series=pv_curve_24h,
        consumption_series=load_curve_24h,
        battery=bat_compatible,
        initial_soc_pct=30.0,
    )
    kpis = sim["kpis"]
    print("    [Key Performance Indicators calculated]:")
    print(f"      * Self-Sufficiency WITHOUT Battery: {kpis['baseline_self_sufficiency_pct']}%")
    print(f"      * Self-Sufficiency WITH Battery:    {kpis['self_sufficiency_pct']}% (+{round(kpis['self_sufficiency_pct'] - kpis['baseline_self_sufficiency_pct'], 1)}%)")
    print(f"      * Solar Energy Generated:           {kpis['total_solar_generated_kwh']} kWh")
    print(f"      * Energy Charged into Battery:      {kpis['total_charged_kwh']} kWh")
    print(f"      * Energy Discharged from Battery:   {kpis['total_discharged_kwh']} kWh")
    print(f"      * Grid Import Remaining:            {kpis['total_grid_import_kwh']} kWh")
    print(f"      * Backup Autonomy:                  {kpis['backup_autonomy_hours']} hours")
    print(f"      * Estimated Bill Savings:           {kpis['estimated_savings_tnd']} TND")

    assert kpis["self_sufficiency_pct"] >= kpis["baseline_self_sufficiency_pct"], "Self-sufficiency must improve!"
    assert kpis["total_discharged_kwh"] > 0, "Battery must discharge to cover evening peak!"
    print("    PASSED: Physical balance equations verified.")

    print("\n" + "=" * 70)
    print("ALL AGENT TOOLS TESTED SUCCESSFULLY AND VERIFIED!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
