"""
Battery Technical AI Agent — Reasoning & Orchestration Layer.
Architecture:
  AI = reasoning + orchestration
  Python = calculations + validation
  Admin = final decision

Orchestrates:
  1. tool_get_installation()
  2. tool_check_compatibility()
  3. tool_get_pv_prediction()
  4. tool_simulate_battery()
  5. tool_compare_batteries()
"""

import os
import json
from typing import Dict, Any, List, Optional
from api.database import query_one, query_all
from api.battery_engine import generate_hourly_consumption
from api.agent.tools import (
    tool_get_installation,
    tool_check_compatibility,
    tool_get_pv_prediction,
    tool_simulate_battery,
    tool_compare_batteries,
    TOOL_REGISTRY,
    get_registered_tools_schemas,
)


import urllib.request
import urllib.error

def _call_llm_enhancement(prompt: str, provide_tools: bool = True) -> Optional[str]:
    """
    Calls an LLM if OLLAMA_API_KEY, OPENAI_API_KEY, or other API key is set.
    Injects registered @tool schemas for autonomous Function Calling capabilities.
    Gracefully returns None if unreachable or on error.
    """
    ollama_key = os.environ.get("OLLAMA_API_KEY")
    if not ollama_key:
        return None

    # Support Ollama Cloud / OpenAI-compatible endpoint
    endpoint = os.environ.get("OLLAMA_API_URL", "https://api.ollama.com/v1/chat/completions")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ollama_key}"
    }
    payload = {
        "model": os.environ.get("OLLAMA_MODEL", "llama3.2"),
        "messages": [
            {
                "role": "system",
                "content": "Tu es un ingénieur expert en réseaux électriques et stockage solaire pour la STEG (Tunisie). Rédige un avis technique concis, professionnel et direct en français."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.3,
        "max_tokens": 300
    }
    if provide_tools:
        tools_schema = get_registered_tools_schemas()
        if tools_schema:
            payload["tools"] = tools_schema

    try:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if "choices" in res_data and len(res_data["choices"]) > 0:
                return res_data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        # Fallback to deterministic expert system
        print(f"[Agent LLM] Warning: LLM call to {endpoint} returned error: {e}. Falling back to deterministic rules.")
        return None

    return None


def _compute_hourly_load(profile: Dict[str, Any], appliances: Optional[List[Dict[str, Any]]], hours: int = 96) -> List[float]:
    """Computes hourly consumption based on either custom appliances or archetype."""
    if appliances and len(appliances) > 0:
        # 24-hour load based on custom appliances
        daily_appliance_kwh = sum(
            (float(app.get("watts", 0)) * float(app.get("quantity", 1)) * float(app.get("hours_per_day", 1))) / 1000.0
            for app in appliances
        )
        base_annual_kwh = max(1000.0, daily_appliance_kwh * 365.0)
    else:
        base_annual_kwh = float(profile.get("annual_consumption_kwh") or 4500.0)

    archetype = profile.get("consumption_archetype", "residential_evening_peak")
    return generate_hourly_consumption(archetype=archetype, annual_kwh=base_annual_kwh, num_hours=hours)


def audit_request_dossier(conn: Any, request_id: int) -> Dict[str, Any]:
    """
    Executes a comprehensive technical audit of a citizen's battery connection request.
    Orchestrates all deterministic tools and applies electrotechnical reasoning.
    """
    # 1. Fetch request
    req = query_one(conn, """
        SELECT r.*, u.email as citizen_email, u.full_name as citizen_name, u.steg_contract_no,
               b.brand, b.model, b.usable_capacity_kwh, b.nominal_capacity_kwh, b.voltage_type,
               b.max_charge_kw, b.max_discharge_kw, b.round_trip_eff, b.steg_certified,
               b.compatible_inverters
        FROM battery_requests r
        JOIN users u ON r.user_id = u.id
        JOIN battery_catalog b ON r.battery_id = b.id
        WHERE r.id = %s
    """, (request_id,))

    if not req:
        raise ValueError(f"Dossier de demande #{request_id} introuvable.")

    profile_snapshot = req["profile_snapshot"]
    if isinstance(profile_snapshot, str):
        try:
            profile_snapshot = json.loads(profile_snapshot)
        except Exception:
            profile_snapshot = {}

    appliances = profile_snapshot.get("appliances", [])
    battery_dict = {
        "id": req["battery_id"],
        "brand": req["brand"],
        "model": req["model"],
        "usable_capacity_kwh": req["usable_capacity_kwh"],
        "nominal_capacity_kwh": req["nominal_capacity_kwh"],
        "voltage_type": req["voltage_type"],
        "max_charge_kw": req["max_charge_kw"],
        "max_discharge_kw": req["max_discharge_kw"],
        "round_trip_eff": req["round_trip_eff"],
        "steg_certified": req["steg_certified"],
        "compatible_inverters": req["compatible_inverters"],
    }

    # 2. Tool Calls
    compat_info = tool_check_compatibility(profile_snapshot, battery_dict)
    
    total_hours = 96
    pv_series = tool_get_pv_prediction(
        governorate=profile_snapshot.get("governorate", "Tunis"),
        capacity_kwp=float(profile_snapshot.get("pv_capacity_kwp") or 4.0),
        hours=total_hours
    )
    
    consumption_series = _compute_hourly_load(profile_snapshot, appliances, hours=total_hours)
    
    sim_result = tool_simulate_battery(
        pv_series=pv_series,
        consumption_series=consumption_series,
        battery=battery_dict,
        initial_soc_pct=50.0
    )
    kpis = sim_result.get("kpis", {})

    # Compare alternatives to check if this was the optimal choice
    alternatives = tool_compare_batteries(
        conn=conn,
        pv_profile=profile_snapshot,
        pv_series=pv_series,
        consumption_series=consumption_series
    )

    # 3. Technical Reasoning & Sizing Scoring
    pv_capacity = float(profile_snapshot.get("pv_capacity_kwp") or 4.0)
    battery_kwh = float(req["usable_capacity_kwh"])
    sizing_ratio = battery_kwh / pv_capacity if pv_capacity > 0 else 1.0  # optimal is 1.0 to 2.5
    
    # Calculate score (0-100)
    score = 100
    findings = []
    
    # Compatibility rule
    if not compat_info["is_compatible"]:
        score -= 50
        findings.append(f"❌ Incompatibilité matérielle : {'; '.join(compat_info['notes'])}")
    else:
        findings.append(f"✅ Compatibilité onduleur/batterie validée (Bus {req['voltage_type']}).")

    if not req["steg_certified"]:
        score -= 30
        findings.append("⚠️ Batterie non homologuée officiellement par la STEG pour le raccordement réseau.")
    else:
        findings.append("✅ Matériel homologué et certifié conforme aux normes STEG.")

    # Sizing rule
    if sizing_ratio < 0.8:
        score -= 15
        findings.append(f"⚠️ Sous-dimensionnement stockage ({sizing_ratio:.2f} kWh/kWc) : Une partie significative du surplus solaire sera réinjectée sans stockage.")
    elif sizing_ratio > 3.0:
        score -= 20
        findings.append(f"⚠️ Surdimensionnement stockage ({sizing_ratio:.2f} kWh/kWc) : La batterie risque de ne pas atteindre 100% de charge en hiver.")
    else:
        findings.append(f"✅ Ratio de dimensionnement optimal ({sizing_ratio:.2f} kWh de stockage par kWc PV).")

    # Self-consumption contribution
    self_cons = kpis.get("self_consumption_pct", 0)
    self_suff = kpis.get("self_sufficiency_pct", 0)
    findings.append(f"📊 Performance simulée : Taux d'autoconsommation = {self_cons:.1f}%, Autonomie = {self_suff:.1f}%.")

    # Grid impact assessment
    if self_cons >= 70 and compat_info["is_compatible"]:
        grid_impact = "HIGH_BENEFIT"
        grid_impact_label = "Forte réduction des pointes réseau (écrêtage midi et injection différée le soir)."
    elif self_cons >= 50:
        grid_impact = "MODERATE_BENEFIT"
        grid_impact_label = "Contribution modérée à la stabilité du réseau de distribution."
    else:
        grid_impact = "LOW_BENEFIT"
        grid_impact_label = "Impact limité sur l'écrêtage des pointes STEG."

    score = max(10, min(100, score))

    # Suggested decision
    if not compat_info["is_compatible"]:
        suggested_decision = "REJECT"
        suggested_reason = f"Rejet technique : L'onduleur installé ({profile_snapshot.get('inverter_brand')} {profile_snapshot.get('inverter_model')}) n'est pas électriquement compatible avec cette batterie."
    elif score < 60:
        suggested_decision = "INFO_REQUESTED"
        suggested_reason = "Complément d'information requis : Veuillez fournir la fiche technique de conformité de l'onduleur et l'attestation de l'installateur agréé."
    else:
        suggested_decision = "APPROVED"
        suggested_reason = f"Dossier technique conforme. Sizing ratio {sizing_ratio:.2f} kWh/kWc équilibré. Homologation STEG validée pour {req['brand']} {req['model']}."

    # Best alternative recommendation if applicable
    better_alternative = None
    if alternatives and alternatives[0]["battery_id"] != req["battery_id"] and alternatives[0]["is_compatible"]:
        top = alternatives[0]
        if top["self_sufficiency_pct"] > self_suff + 5:
            better_alternative = {
                "battery_id": top["battery_id"],
                "name": f"{top['brand']} {top['model']}",
                "self_sufficiency_pct": top["self_sufficiency_pct"],
                "gain_pct": round(top["self_sufficiency_pct"] - self_suff, 1)
            }

    # 4. Optional LLM Expert Commentary
    llm_prompt = (
        f"Analyse technique dossier STEG #{request_id} :\n"
        f"- Citoyen : {req['citizen_name']} (Contrat : {req['steg_contract_no']})\n"
        f"- Solaire : {profile_snapshot.get('pv_capacity_kwp')} kWc, Onduleur {profile_snapshot.get('inverter_brand')} ({profile_snapshot.get('battery_bus_type')})\n"
        f"- Batterie : {req['brand']} {req['model']} ({req['usable_capacity_kwh']} kWh, {req['voltage_type']})\n"
        f"- Compatibilité : {'VALIDE' if compat_info['is_compatible'] else 'INCOMPATIBLE'}\n"
        f"- Performance calculée : Autoconsommation={self_cons:.1f}%, Autonomie={self_suff:.1f}%\n"
        f"- Décision recommandée : {suggested_decision}\n"
        f"Rédige une appréciation d'ingénieur en 2 phrases pour l'administrateur STEG."
    )
    llm_commentary = _call_llm_enhancement(llm_prompt)

    # 5. Generate synthesis report
    return {
        "request_id": request_id,
        "citizen_name": req["citizen_name"],
        "steg_contract_no": req["steg_contract_no"],
        "battery_selected": f"{req['brand']} {req['model']}",
        "score": score,
        "compatibility_verdict": "PASSED" if compat_info["is_compatible"] else "FAILED",
        "sizing_ratio": round(sizing_ratio, 2),
        "grid_impact": grid_impact,
        "grid_impact_label": grid_impact_label,
        "suggested_decision": suggested_decision,
        "suggested_reason": suggested_reason,
        "llm_commentary": llm_commentary,
        "technical_findings": findings,
        "simulation_kpis": {
            "self_consumption_pct": self_cons,
            "self_sufficiency_pct": self_suff,
            "grid_import_kwh": kpis.get("total_grid_imported_kwh", 0),
            "grid_export_kwh": kpis.get("total_grid_exported_kwh", 0),
            "curtailment_prevented_kwh": kpis.get("curtailment_prevented_kwh", 0),
        },
        "better_alternative": better_alternative,
        "agent_version": "PESTGM-Agent-v1.0 (Deterministic Physics + Heuristic Reasoning)"
    }


def recommend_optimal_battery(conn: Any, user_id: int, custom_appliances: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Advisor Agent for Citizens:
    Scans the certified catalog and determines the optimal battery for the citizen's specific setup.
    """
    profile = tool_get_installation(conn, user_id)
    if not profile:
        raise ValueError("Profil PV inexistant. Veuillez configurer votre installation.")

    total_hours = 96
    pv_series = tool_get_pv_prediction(
        governorate=profile.get("governorate", "Tunis"),
        capacity_kwp=float(profile.get("pv_capacity_kwp") or 4.0),
        hours=total_hours
    )
    
    consumption_series = _compute_hourly_load(profile, custom_appliances, hours=total_hours)

    # Compare all candidates
    candidates = tool_compare_batteries(
        conn=conn,
        pv_profile=profile,
        pv_series=pv_series,
        consumption_series=consumption_series
    )

    compatible_candidates = [c for c in candidates if c["is_compatible"]]
    
    if not compatible_candidates:
        return {
            "has_recommendation": False,
            "message": "Aucune batterie dans le catalogue actuel n'est compatible avec les caractéristiques de votre onduleur.",
            "candidates": candidates
        }

    # Best recommendation
    best = compatible_candidates[0]
    pv_kwp = float(profile["pv_capacity_kwp"])
    ratio = round(best["usable_capacity_kwh"] / pv_kwp, 2) if pv_kwp > 0 else 1.0

    reasoning = [
        f"Compatibilité électrique parfaite avec votre onduleur {profile['inverter_brand']} ({profile['battery_bus_type']}).",
        f"Capacité utile de {best['usable_capacity_kwh']} kWh permettant d'atteindre {best['self_sufficiency_pct']:.1f}% d'autonomie énergétique.",
        f"Autonomie de secours estimée à ~{best['backup_autonomy_hours']} heures en cas de coupure réseau STEG.",
        f"Ratio de dimensionnement équilibré de {ratio:.2f} kWh/kWc."
    ]

    return {
        "has_recommendation": True,
        "recommended_battery": best,
        "reasoning": reasoning,
        "all_compatible": compatible_candidates[:4],
    }
