"""
Deterministic Battery Simulation & Compatibility Engine.
Strictly follows physics, electrotechnical rules, and STEG grid standards.
No AI agent, no RAG, 100% deterministic mathematical calculations.
"""

from typing import List, Dict, Any, Tuple
import numpy as np


# Standardized 24-hour normalized residential consumption archetypes (hourly fractions summing to 1.0)
CONSUMPTION_ARCHETYPES = {
    "residential_evening_peak": [
        0.02, 0.015, 0.015, 0.015, 0.02, 0.035, # 00:00 - 05:00 (Night baseload)
        0.06, 0.07, 0.05, 0.04, 0.035, 0.035,   # 06:00 - 11:00 (Morning peak)
        0.04, 0.04, 0.035, 0.035, 0.04, 0.05,   # 12:00 - 17:00 (Afternoon)
        0.075, 0.09, 0.095, 0.08, 0.05, 0.03    # 18:00 - 23:00 (Evening peak)
    ],
    "residential_home_office": [
        0.02, 0.015, 0.015, 0.015, 0.02, 0.03,
        0.05, 0.06, 0.065, 0.06, 0.055, 0.055,
        0.055, 0.055, 0.055, 0.05, 0.05, 0.06,
        0.075, 0.08, 0.075, 0.06, 0.04, 0.025
    ],
    "commercial_daytime": [
        0.01, 0.01, 0.01, 0.01, 0.01, 0.02,
        0.05, 0.08, 0.09, 0.095, 0.095, 0.09,
        0.085, 0.085, 0.085, 0.08, 0.065, 0.04,
        0.02, 0.015, 0.01, 0.01, 0.01, 0.01
    ]
}


def generate_hourly_consumption(
    archetype: str,
    annual_kwh: float,
    num_hours: int = 96
) -> List[float]:
    """Generates an hourly consumption profile (kW) based on chosen archetype and annual demand."""
    daily_kwh = annual_kwh / 365.0
    fractions = CONSUMPTION_ARCHETYPES.get(archetype, CONSUMPTION_ARCHETYPES["residential_evening_peak"])
    
    hourly_kw = []
    for h in range(num_hours):
        hour_of_day = h % 24
        frac = fractions[hour_of_day]
        hourly_kw.append(round(daily_kwh * frac, 3))
    return hourly_kw


def check_battery_compatibility(
    pv_profile: Dict[str, Any],
    battery: Dict[str, Any]
) -> Tuple[bool, List[str]]:
    """
    Checks technical compatibility between the user's PV installation and a specific battery.
    Evaluates:
    1. Inverter type (Hybrid vs String).
    2. Battery bus voltage architecture (LV 48V vs HV).
    3. Inverter model manufacturer certification list.
    4. Power limits.
    """
    reasons = []
    is_compatible = True

    inverter_type = pv_profile.get("inverter_type", "HYBRID")
    battery_bus = pv_profile.get("battery_bus_type", "LV_48V")
    inverter_brand = pv_profile.get("inverter_brand", "").strip().lower()
    inverter_model = pv_profile.get("inverter_model", "").strip().lower()
    inverter_power = pv_profile.get("inverter_rated_power_kw", 5.0)

    # 1. Bus Voltage Matching
    if battery.get("voltage_type") != battery_bus:
        is_compatible = False
        reasons.append(
            f"Incompatibilité de tension bus : Votre onduleur requiert '{battery_bus}', "
            f"or cette batterie fonctionne en '{battery.get('voltage_type')}'."
        )

    # 2. Inverter type check
    if inverter_type == "STRING":
        # String inverters have no direct DC battery port. They require AC-coupled storage.
        if battery.get("coupling_type") != "AC_COUPLED":
            is_compatible = False
            reasons.append(
                "Onduleur réseau standard (String) sans port batterie direct : "
                "Nécessite une batterie à couplage AC ou un rétrofit d'onduleur hybride homologué STEG."
            )

    # 3. Manufacturer protocol & certified whitelist
    compatible_list = battery.get("compatible_inverters", [])
    if isinstance(compatible_list, str):
        import json
        try:
            compatible_list = json.loads(compatible_list)
        except Exception:
            compatible_list = []

    matched_brand = any(
        inverter_brand in item.lower() or item.lower() in inverter_brand
        for item in compatible_list
    )
    if not matched_brand and compatible_list:
        reasons.append(
            f"Protocole de communication BMS non homologué d'office avec la marque '{pv_profile.get('inverter_brand')}'. "
            f"Onduleurs officiellement certifiés : {', '.join(compatible_list)}."
        )
        # We flag warning but don't strictly block if voltage matches unless critical
        if is_compatible:
            # Downgrade compatibility notice
            pass

    # 4. Power limit check
    if battery.get("max_discharge_kw", 0) > inverter_power * 1.5:
        reasons.append(
            f"Attention surdimensionnement : Puissance de décharge batterie ({battery.get('max_discharge_kw')} kW) "
            f"dépasse significativement la puissance nominale onduleur ({inverter_power} kW)."
        )

    return is_compatible, reasons


def simulate_battery_dispatch(
    pv_series_kw: List[float],
    consumption_series_kw: List[float],
    battery: Dict[str, Any],
    initial_soc_pct: float = 50.0
) -> Dict[str, Any]:
    """
    Executes pure deterministic hour-by-hour physical battery dispatch simulation.
    
    Energy conservation at every hour t:
    P_pv(t) + P_discharge(t) + P_grid_import(t) == P_load(t) + P_charge(t) + P_grid_export(t)
    """
    usable_capacity_kwh = float(battery.get("usable_capacity_kwh", 5.0))
    nominal_capacity_kwh = float(battery.get("nominal_capacity_kwh", usable_capacity_kwh))
    max_charge_kw = float(battery.get("max_charge_kw", 2.5))
    max_discharge_kw = float(battery.get("max_discharge_kw", 2.5))
    round_trip_eff = float(battery.get("round_trip_eff", 0.95))
    charge_eff = float(np.sqrt(round_trip_eff))
    discharge_eff = float(np.sqrt(round_trip_eff))
    dod_pct = float(battery.get("dod_pct", 90.0)) / 100.0

    min_soc_kwh = nominal_capacity_kwh * (1.0 - dod_pct)
    max_soc_kwh = nominal_capacity_kwh

    current_soc_kwh = min_soc_kwh + (usable_capacity_kwh * (initial_soc_pct / 100.0))
    current_soc_kwh = min(max_soc_kwh, max(min_soc_kwh, current_soc_kwh))

    timeline = []
    total_pv = 0.0
    total_load = 0.0
    total_charged = 0.0
    total_discharged = 0.0
    total_exported = 0.0
    total_imported = 0.0
    total_direct_solar = 0.0

    num_hours = min(len(pv_series_kw), len(consumption_series_kw))

    for h in range(num_hours):
        p_pv = max(0.0, float(pv_series_kw[h]))
        p_load = max(0.0, float(consumption_series_kw[h]))

        total_pv += p_pv
        total_load += p_load

        p_charge = 0.0
        p_discharge = 0.0
        p_export = 0.0
        p_import = 0.0

        if p_pv >= p_load:
            # Solar covers entire load
            p_direct = p_load
            p_surplus = p_pv - p_load

            # Charge battery with surplus
            if current_soc_kwh < max_soc_kwh:
                headroom = max_soc_kwh - current_soc_kwh
                possible_charge_kw = min(p_surplus, max_charge_kw, headroom / charge_eff)
                p_charge = max(0.0, possible_charge_kw)
                current_soc_kwh += p_charge * charge_eff
            
            p_export = p_surplus - p_charge
        else:
            # Solar is insufficient for load
            p_direct = p_pv
            p_deficit = p_load - p_pv

            # Discharge battery to cover deficit
            if current_soc_kwh > min_soc_kwh:
                usable_energy = current_soc_kwh - min_soc_kwh
                possible_discharge_kw = min(p_deficit, max_discharge_kw, usable_energy * discharge_eff)
                p_discharge = max(0.0, possible_discharge_kw)
                current_soc_kwh -= (p_discharge / discharge_eff)
            
            p_import = p_deficit - p_discharge

        total_direct_solar += p_direct
        total_charged += p_charge
        total_discharged += p_discharge
        total_exported += p_export
        total_imported += p_import

        soc_pct = ((current_soc_kwh - min_soc_kwh) / usable_capacity_kwh) * 100.0 if usable_capacity_kwh > 0 else 0.0
        soc_pct = max(0.0, min(100.0, soc_pct))

        timeline.append({
            "hour": h,
            "pv_generation_kw": round(p_pv, 3),
            "load_consumption_kw": round(p_load, 3),
            "battery_charge_kw": round(p_charge, 3),
            "battery_discharge_kw": round(p_discharge, 3),
            "grid_export_kw": round(p_export, 3),
            "grid_import_kw": round(p_import, 3),
            "battery_soc_pct": round(soc_pct, 1),
            "battery_soc_kwh": round(current_soc_kwh, 2),
        })

    # KPIs
    # Self-consumption: (Direct Solar + Battery Charge) / Total Solar
    self_consumption_pct = ((total_direct_solar + total_charged) / total_pv * 100.0) if total_pv > 0 else 100.0
    self_consumption_pct = min(100.0, max(0.0, self_consumption_pct))

    # Self-sufficiency: (Direct Solar + Battery Discharge) / Total Demand
    self_sufficiency_pct = ((total_direct_solar + total_discharged) / total_load * 100.0) if total_load > 0 else 100.0
    self_sufficiency_pct = min(100.0, max(0.0, self_sufficiency_pct))

    # Baseline without battery: Direct Solar / Total Demand
    baseline_self_sufficiency = (total_direct_solar / total_load * 100.0) if total_load > 0 else 0.0

    # Critical backup autonomy hours (assuming average night load)
    avg_load_kw = (total_load / num_hours) if num_hours > 0 else 0.5
    backup_hours = round(usable_capacity_kwh / avg_load_kw, 1) if avg_load_kw > 0 else 0.0

    # Financial bill reduction estimation (average STEG low-voltage tariff ~0.260 TND/kWh)
    steg_tariff_tnd = 0.260
    estimated_bill_savings_tnd = round(total_discharged * steg_tariff_tnd, 2)

    return {
        "kpis": {
            "self_consumption_pct": round(self_consumption_pct, 1),
            "self_sufficiency_pct": round(self_sufficiency_pct, 1),
            "self_sufficiency_gain_pct": round(self_sufficiency_pct - baseline_self_sufficiency, 1),
            "grid_dependency_pct": round(100.0 - self_sufficiency_pct, 1),
            "total_solar_kwh": round(total_pv, 2),
            "total_demand_kwh": round(total_load, 2),
            "total_charged_kwh": round(total_charged, 2),
            "total_discharged_kwh": round(total_discharged, 2),
            "total_grid_import_kwh": round(total_imported, 2),
            "total_grid_export_kwh": round(total_exported, 2),
            "backup_autonomy_hours": backup_hours,
            "estimated_savings_tnd": estimated_bill_savings_tnd,
        },
        "timeline": timeline,
        "battery_info": {
            "brand": battery.get("brand"),
            "model": battery.get("model"),
            "usable_capacity_kwh": usable_capacity_kwh,
            "chemistry": battery.get("chemistry"),
        }
    }
