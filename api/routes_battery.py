"""
FastAPI Routes for Battery Module:
- Auth (Register, Login, Me)
- Citizen PV Profile (Get, Update)
- Battery Catalog & Compatibility
- Battery Simulation & Comparison
- Citizen Request Submission (One citizen to many requests)
- Admin Review & Lifecycle Tracking
"""

from datetime import datetime, timezone
import json
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
import pandas as pd

from api.database import (
    get_db,
    query_one,
    query_all,
    execute_insert_returning_id,
    execute_write,
    USE_POSTGRES,
)
from api.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_password_reset_token,
    verify_password_reset_token,
    get_current_user,
    get_current_admin,
)
from api.battery_engine import (
    generate_hourly_consumption,
    check_battery_compatibility,
    simulate_battery_dispatch,
)
from src import config
from src.forecast import GOVERNORATES, predict_for_all_governorates, save_forecast
from api.agent.technical_agent import audit_request_dossier, recommend_optimal_battery

router = APIRouter(prefix="/api/battery", tags=["Battery Module"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "CITIZEN"
    steg_contract_no: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class PVProfileRequest(BaseModel):
    pv_capacity_kwp: float
    governorate: str
    inverter_brand: str
    inverter_model: str
    inverter_type: str  # HYBRID or STRING
    inverter_rated_power_kw: float
    battery_bus_type: str  # LV_48V or HV
    consumption_archetype: str
    annual_consumption_kwh: Optional[float] = 4500.0


class SimulationRequest(BaseModel):
    battery_id: int
    initial_soc_pct: Optional[float] = 50.0
    horizon_days: Optional[int] = 4  # D to D+3 (96 hours)


class ComparisonRequest(BaseModel):
    battery_ids: List[int]
    horizon_days: Optional[int] = 4


class ApplianceItem(BaseModel):
    name: str
    consumption_w: float  # consumption power in Watts (or kWh if daily)
    quantity: Optional[int] = 1
    hours_per_day: Optional[float] = None


class CitizenRequestSubmission(BaseModel):
    battery_id: int
    document_ref: Optional[str] = "Dossier_Technique_STEG.pdf"
    notes: Optional[str] = None
    appliances: Optional[List[ApplianceItem]] = []


class AdminDecisionRequest(BaseModel):
    status: str  # APPROVED, REJECTED, INFO_REQUESTED, UNDER_REVIEW
    admin_notes: Optional[str] = None


class InstallationStageUpdate(BaseModel):
    stage: str  # APPROVED, INSTALLATION_SCHEDULED, INSTALLING, COMMISSIONING, ACTIVE
    installer_name: Optional[str] = None
    scheduled_date: Optional[str] = None
    commissioning_date: Optional[str] = None
    steg_meter_ref: Optional[str] = None
    notes: Optional[str] = None


class AgentRecommendRequest(BaseModel):
    appliances: Optional[List[ApplianceItem]] = []


# ---------------------------------------------------------------------------
# 1. Authentication Endpoints
# ---------------------------------------------------------------------------
@router.post("/auth/register")
def register(req: RegisterRequest):
    # Enforce role to CITIZEN on self-registration for security
    role = "CITIZEN"
    
    with get_db() as conn:
        existing = query_one(conn, "SELECT id FROM users WHERE email = %s", (req.email,))
        if existing:
            raise HTTPException(status_code=400, detail="Cette adresse email est déjà enregistrée.")

        pw_hash = hash_password(req.password)
        sql = """
            INSERT INTO users (email, password_hash, full_name, role, steg_contract_no)
            VALUES (%s, %s, %s, %s, %s)
        """
        user_id = execute_insert_returning_id(
            conn, sql, (req.email, pw_hash, req.full_name, role, req.steg_contract_no), id_column="id"
        )

    token = create_access_token({"sub": user_id, "role": role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": req.email,
            "full_name": req.full_name,
            "role": role,
            "steg_contract_no": req.steg_contract_no,
        }
    }


@router.post("/auth/login")
def login(req: LoginRequest):
    with get_db() as conn:
        user = query_one(
            conn,
            "SELECT id, email, password_hash, full_name, role, steg_contract_no FROM users WHERE email = %s",
            (req.email,)
        )

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")

    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "steg_contract_no": user.get("steg_contract_no"),
        }
    }


@router.get("/auth/me")
def me(user: Dict[str, Any] = Depends(get_current_user)):
    return user


@router.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """
    Initiates password recovery.
    Verifies user exists, generates a signed 1-hour reset token,
    and returns instructions with reset token.
    """
    with get_db() as conn:
        user = query_one(conn, "SELECT id, email, full_name FROM users WHERE email = %s", (req.email,))
    
    if not user:
        # Avoid user enumeration by returning success message
        return {
            "status": "success",
            "message": "Si cette adresse email existe dans notre base, un lien de réinitialisation a été généré.",
        }

    reset_token = create_password_reset_token(user["email"])
    return {
        "status": "success",
        "message": "Un jeton de réinitialisation a été généré avec succès (valable 1 heure).",
        "reset_token": reset_token,
        "email": user["email"],
    }


@router.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    """
    Validates the password recovery token and updates the user's password in Neon Postgres / DB.
    """
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit comporter au moins 6 caractères.")

    email = verify_password_reset_token(req.token)
    if not email:
        raise HTTPException(status_code=400, detail="Le lien ou jeton de réinitialisation est invalide ou a expiré.")

    new_pw_hash = hash_password(req.new_password)
    with get_db() as conn:
        execute_write(
            conn,
            "UPDATE users SET password_hash = %s WHERE email = %s",
            (new_pw_hash, email)
        )

    return {
        "status": "success",
        "message": "Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter."
    }


# ---------------------------------------------------------------------------
# 2. Citizen PV Profile Endpoints
# ---------------------------------------------------------------------------
@router.get("/profile")
def get_pv_profile(user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        profile = query_one(conn, "SELECT * FROM pv_profiles WHERE user_id = %s", (user["id"],))
        if not profile:
            # Return default profile template for quick start
            return {
                "pv_capacity_kwp": 5.0,
                "governorate": "Tunis",
                "inverter_brand": "Huawei",
                "inverter_model": "SUN2000-5KTL-L1",
                "inverter_type": "HYBRID",
                "inverter_rated_power_kw": 5.0,
                "battery_bus_type": "HV",
                "consumption_archetype": "residential_evening_peak",
                "annual_consumption_kwh": 4800.0,
                "is_created": False
            }
        return {**profile, "is_created": True}


@router.post("/profile")
def save_pv_profile(req: PVProfileRequest, user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        sql = """
            INSERT INTO pv_profiles (
                user_id, pv_capacity_kwp, governorate, inverter_brand, inverter_model,
                inverter_type, inverter_rated_power_kw, battery_bus_type,
                consumption_archetype, annual_consumption_kwh
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(user_id) DO UPDATE SET
                pv_capacity_kwp=excluded.pv_capacity_kwp,
                governorate=excluded.governorate,
                inverter_brand=excluded.inverter_brand,
                inverter_model=excluded.inverter_model,
                inverter_type=excluded.inverter_type,
                inverter_rated_power_kw=excluded.inverter_rated_power_kw,
                battery_bus_type=excluded.battery_bus_type,
                consumption_archetype=excluded.consumption_archetype,
                annual_consumption_kwh=excluded.annual_consumption_kwh
        """
        execute_write(conn, sql, (
            user["id"], req.pv_capacity_kwp, req.governorate, req.inverter_brand, req.inverter_model,
            req.inverter_type, req.inverter_rated_power_kw, req.battery_bus_type,
            req.consumption_archetype, req.annual_consumption_kwh
        ))
    return {"status": "success", "message": "Profil d'installation photovoltaïque sauvegardé avec succès."}


# ---------------------------------------------------------------------------
# 3. Battery Catalog & Compatibility
# ---------------------------------------------------------------------------
@router.get("/catalog")
def get_catalog():
    with get_db() as conn:
        rows = query_all(conn, "SELECT * FROM battery_catalog ORDER BY brand, usable_capacity_kwh ASC;")
        result = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("compatible_inverters"), str):
                try:
                    d["compatible_inverters"] = json.loads(d["compatible_inverters"])
                except Exception:
                    d["compatible_inverters"] = []
            elif not d.get("compatible_inverters"):
                d["compatible_inverters"] = []
            result.append(d)
        return result


@router.get("/compatible")
def get_compatible_batteries(user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        profile = query_one(conn, "SELECT * FROM pv_profiles WHERE user_id = %s", (user["id"],))
        if not profile:
            profile = {
                "inverter_brand": "Huawei",
                "inverter_model": "SUN2000",
                "inverter_type": "HYBRID",
                "battery_bus_type": "HV",
                "inverter_rated_power_kw": 5.0,
            }

        all_batteries = query_all(conn, "SELECT * FROM battery_catalog ORDER BY usable_capacity_kwh ASC;")

    evaluated = []
    for b_dict in all_batteries:
        if isinstance(b_dict.get("compatible_inverters"), str):
            try:
                b_dict["compatible_inverters"] = json.loads(b_dict["compatible_inverters"])
            except Exception:
                b_dict["compatible_inverters"] = []
        elif not b_dict.get("compatible_inverters"):
            b_dict["compatible_inverters"] = []

        is_compatible, notes = check_battery_compatibility(profile, b_dict)
        evaluated.append({
            **b_dict,
            "is_compatible": is_compatible,
            "compatibility_notes": notes,
        })
    return evaluated


# ---------------------------------------------------------------------------
# 4. PV Prediction Helper
# ---------------------------------------------------------------------------
def get_user_pv_prediction_series(governorate: str, capacity_kwp: float, hours: int = 96) -> List[float]:
    """Retrieves or forecasts normalized solar output and scales by citizen capacity."""
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
        # Fallback to Tunis
        sub = df[df["governorate"] == "Tunis"]

    if sub.empty:
        # Emergency physical fallback curve if offline
        return [0.0] * hours

    p_series_kw = (sub["P"].values * (capacity_kwp / 1000.0)).tolist()
    if len(p_series_kw) < hours:
        p_series_kw = (p_series_kw * 3)[:hours]
    return p_series_kw[:hours]


# ---------------------------------------------------------------------------
# 5. Battery Simulation & Comparison
# ---------------------------------------------------------------------------
@router.post("/simulate")
def run_simulation(req: SimulationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        profile = query_one(conn, "SELECT * FROM pv_profiles WHERE user_id = %s", (user["id"],))
        if not profile:
            raise HTTPException(status_code=400, detail="Veuillez d'abord configurer votre profil d'installation PV.")

        battery = query_one(conn, "SELECT * FROM battery_catalog WHERE id = %s", (req.battery_id,))
        if not battery:
            raise HTTPException(status_code=404, detail="Batterie introuvable dans le catalogue.")

    total_hours = (req.horizon_days or 4) * 24
    pv_series = get_user_pv_prediction_series(
        governorate=profile["governorate"],
        capacity_kwp=profile["pv_capacity_kwp"],
        hours=total_hours
    )

    consumption_series = generate_hourly_consumption(
        archetype=profile["consumption_archetype"],
        annual_kwh=profile.get("annual_consumption_kwh", 4500.0),
        num_hours=total_hours
    )

    sim_result = simulate_battery_dispatch(
        pv_series_kw=pv_series,
        consumption_series_kw=consumption_series,
        battery=battery,
        initial_soc_pct=req.initial_soc_pct or 50.0
    )

    sim_result["profile"] = {
        "pv_capacity_kwp": profile["pv_capacity_kwp"],
        "governorate": profile["governorate"],
        "inverter_brand": profile["inverter_brand"],
        "inverter_model": profile["inverter_model"],
    }
    return sim_result


@router.post("/compare")
def compare_batteries(req: ComparisonRequest, user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        profile = query_one(conn, "SELECT * FROM pv_profiles WHERE user_id = %s", (user["id"],))
        if not profile:
            raise HTTPException(status_code=400, detail="Profil PV manquant pour comparaison.")

    total_hours = (req.horizon_days or 4) * 24
    pv_series = get_user_pv_prediction_series(
        governorate=profile["governorate"],
        capacity_kwp=profile["pv_capacity_kwp"],
        hours=total_hours
    )
    consumption_series = generate_hourly_consumption(
        archetype=profile["consumption_archetype"],
        annual_kwh=profile.get("annual_consumption_kwh", 4500.0),
        num_hours=total_hours
    )

    comparisons = []
    with get_db() as conn:
        for b_id in req.battery_ids:
            battery = query_one(conn, "SELECT * FROM battery_catalog WHERE id = %s", (b_id,))
            if battery:
                res = simulate_battery_dispatch(
                    pv_series_kw=pv_series,
                    consumption_series_kw=consumption_series,
                    battery=battery,
                    initial_soc_pct=50.0
                )
                comparisons.append({
                    "battery_id": b_id,
                    "brand": battery["brand"],
                    "model": battery["model"],
                    "nominal_capacity_kwh": battery["nominal_capacity_kwh"],
                    "usable_capacity_kwh": battery["usable_capacity_kwh"],
                    "voltage_type": battery["voltage_type"],
                    "kpis": res["kpis"]
                })
    return {"comparisons": comparisons}


# ---------------------------------------------------------------------------
# 6. Citizen Requests & Tracking (One Citizen -> Many Requests)
# ---------------------------------------------------------------------------
@router.post("/request")
def submit_request(req: CitizenRequestSubmission, user: Dict[str, Any] = Depends(get_current_user)):
    with get_db() as conn:
        profile = query_one(conn, "SELECT * FROM pv_profiles WHERE user_id = %s", (user["id"],))
        if not profile:
            raise HTTPException(status_code=400, detail="Veuillez compléter votre profil PV avant de soumettre une demande.")

        battery = query_one(conn, "SELECT * FROM battery_catalog WHERE id = %s", (req.battery_id,))
        if not battery:
            raise HTTPException(status_code=404, detail="Batterie sélectionnée introuvable.")

        # Run fresh 96h simulation to freeze snapshot
        pv_series = get_user_pv_prediction_series(profile["governorate"], profile["pv_capacity_kwp"], 96)
        load_series = generate_hourly_consumption(profile["consumption_archetype"], profile.get("annual_consumption_kwh", 4500.0), 96)
        sim_res = simulate_battery_dispatch(pv_series, load_series, battery)

        # Handle JSON representation according to DB backend
        profile_json = json.dumps(profile)
        kpis_json = json.dumps(sim_res["kpis"])
        appliances_json = json.dumps([a.dict() for a in (req.appliances or [])])

        sql = """
            INSERT INTO battery_requests (
                user_id, battery_id, profile_snapshot, simulation_results, appliances, status, document_ref
            ) VALUES (%s, %s, %s, %s, %s, 'SUBMITTED', %s)
        """
        request_id = execute_insert_returning_id(
            conn, sql, (user["id"], req.battery_id, profile_json, kpis_json, appliances_json, req.document_ref), id_column="id"
        )

    return {
        "status": "success",
        "request_id": request_id,
        "message": "Votre demande d'installation de stockage batterie a été soumise avec succès aux services techniques STEG."
    }


@router.get("/requests/my")
def get_my_requests(user: Dict[str, Any] = Depends(get_current_user)):
    """Fetches all battery requests submitted by the logged-in citizen."""
    with get_db() as conn:
        sql = """
            SELECT 
                r.id, r.user_id, r.status, r.admin_notes, r.document_ref, r.appliances, r.created_at, r.updated_at,
                b.brand as battery_brand, b.model as battery_model, b.usable_capacity_kwh,
                t.stage as tracking_stage, t.scheduled_date, t.commissioning_date, t.installer_name
            FROM battery_requests r
            JOIN battery_catalog b ON r.battery_id = b.id
            LEFT JOIN installation_tracking t ON r.id = t.request_id
            WHERE r.user_id = %s
            ORDER BY r.created_at DESC
        """
        rows = query_all(conn, sql, (user["id"],))
        for r in rows:
            if isinstance(r.get("appliances"), str):
                try:
                    r["appliances"] = json.loads(r["appliances"])
                except Exception:
                    r["appliances"] = []
            elif r.get("appliances") is None:
                r["appliances"] = []
        return rows


# ---------------------------------------------------------------------------
# 7. Admin Review Panel Endpoints
# ---------------------------------------------------------------------------
@router.get("/admin/requests")
def get_all_requests(
    status_filter: Optional[str] = Query(None),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    with get_db() as conn:
        query = """
            SELECT 
                r.id, r.user_id, r.status, r.admin_notes, r.document_ref, r.appliances, r.created_at, r.profile_snapshot, r.simulation_results,
                u.full_name as citizen_name, u.email as citizen_email, u.steg_contract_no,
                b.brand as battery_brand, b.model as battery_model, b.usable_capacity_kwh, b.voltage_type,
                t.stage as tracking_stage, t.installer_name, t.scheduled_date, t.commissioning_date, t.steg_meter_ref
            FROM battery_requests r
            JOIN users u ON r.user_id = u.id
            JOIN battery_catalog b ON r.battery_id = b.id
            LEFT JOIN installation_tracking t ON r.id = t.request_id
        """
        params = []
        if status_filter:
            query += " WHERE r.status = %s"
            params.append(status_filter)
        query += " ORDER BY r.created_at DESC"

        rows = query_all(conn, query, tuple(params))
        result = []
        for d in rows:
            if isinstance(d.get("profile_snapshot"), str):
                try:
                    d["profile_snapshot"] = json.loads(d["profile_snapshot"])
                except Exception:
                    pass
            if isinstance(d.get("simulation_results"), str):
                try:
                    d["simulation_results"] = json.loads(d["simulation_results"])
                except Exception:
                    pass
            if isinstance(d.get("appliances"), str):
                try:
                    d["appliances"] = json.loads(d["appliances"])
                except Exception:
                    d["appliances"] = []
            elif d.get("appliances") is None:
                d["appliances"] = []
            result.append(d)
        return result



@router.patch("/admin/requests/{request_id}/decision")
def update_request_decision(
    request_id: int,
    req: AdminDecisionRequest,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    valid_statuses = ("SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED")
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Statuts autorisés: {valid_statuses}")

    with get_db() as conn:
        existing = query_one(conn, "SELECT id, status FROM battery_requests WHERE id = %s", (request_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Demande introuvable.")

        # Update decision status
        execute_write(
            conn,
            """
            UPDATE battery_requests 
            SET status = %s, admin_notes = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (req.status, req.admin_notes, request_id)
        )

        # If approved, initialize installation tracking record if not present
        if req.status == "APPROVED":
            execute_write(
                conn,
                """
                INSERT INTO installation_tracking (request_id, stage, notes)
                VALUES (%s, 'APPROVED', 'Demande validée techniquement par la STEG. En attente de planification.')
                ON CONFLICT(request_id) DO NOTHING
                """,
                (request_id,)
            )

    return {"status": "success", "message": f"Demande #{request_id} mise à jour: {req.status}"}


@router.patch("/admin/tracking/{request_id}")
def update_installation_stage(
    request_id: int,
    req: InstallationStageUpdate,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    with get_db() as conn:
        execute_write(
            conn,
            """
            UPDATE installation_tracking
            SET 
                stage = COALESCE(%s, stage),
                installer_name = COALESCE(%s, installer_name),
                scheduled_date = COALESCE(%s, scheduled_date),
                commissioning_date = COALESCE(%s, commissioning_date),
                steg_meter_ref = COALESCE(%s, steg_meter_ref),
                notes = COALESCE(%s, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE request_id = %s
            """,
            (
                req.stage, req.installer_name, req.scheduled_date, req.commissioning_date,
                req.steg_meter_ref, req.notes, request_id
            )
        )

    return {"status": "success", "message": f"Étape d'installation de la demande #{request_id} mise à jour: {req.stage}"}


# ---------------------------------------------------------------------------
# 8. Agentic AI — Battery Technical Agent
# ---------------------------------------------------------------------------
@router.post("/agent/audit-request/{request_id}")
def audit_request_with_agent(
    request_id: int,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Agentic AI endpoint for STEG Admins:
    Orchestrates deterministic tools (get_installation, check_compatibility,
    get_pv_prediction, simulate_battery, compare_batteries) to perform an
    automated electrotechnical audit and recommend an informed approval decision.
    """
    with get_db() as conn:
        try:
            audit_report = audit_request_dossier(conn, request_id)
            return audit_report
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Erreur d'audit par l'agent IA : {str(e)}")


@router.post("/agent/recommend")
def recommend_battery_with_agent(
    req: AgentRecommendRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Agentic AI advisor endpoint for Citizens:
    Scans certified catalog batteries, checks technical compatibility with
    user's inverter, and runs dispatch simulation against custom appliances
    to recommend the optimal storage solution.
    """
    with get_db() as conn:
        try:
            appliances_data = [a.model_dump() for a in req.appliances] if req.appliances else []
            recommendation = recommend_optimal_battery(conn, user["id"], appliances_data)
            return recommendation
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Erreur du conseiller IA : {str(e)}")

