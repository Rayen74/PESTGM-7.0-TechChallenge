import {
  ForecastResponse,
  SpatialSummaryResponse,
  DispatchPreviewResponse,
  TelemetryResponse,
  MetadataResponse,
  PVProfile,
  BatteryItem,
  SimulationResult,
  BatteryComparisonItem,
  BatteryRequestItem,
  ApplianceItem,
  User,
} from "./types";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Helper to get auth header from localStorage
function getAuthHeader(): Record<string, string> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("steg_solar_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

export async function fetchMetadata(): Promise<MetadataResponse> {
  const res = await fetch(`${API_BASE}/api/meta`);
  if (!res.ok) throw new Error("Échec du chargement des métadonnées");
  return res.json();
}

export async function fetchForecast(params: {
  scale_level: "national" | "district" | "governorate";
  entity_name?: string;
  horizon: "intra_day" | "d_to_d3" | "full";
  capacity_kwp: number;
  unit: "W" | "kW" | "MW";
  confidence_level: number;
}): Promise<ForecastResponse> {
  const query = new URLSearchParams({
    scale_level: params.scale_level,
    horizon: params.horizon,
    capacity_kwp: params.capacity_kwp.toString(),
    unit: params.unit,
    confidence_level: (params.confidence_level / 100).toString(),
  });
  if (params.entity_name) {
    query.set("entity_name", params.entity_name);
  }

  const res = await fetch(`${API_BASE}/api/forecast?${query.toString()}`);
  if (!res.ok) throw new Error("Échec de la récupération des prévisions");
  return res.json();
}

export async function fetchSpatialSummary(params: {
  horizon: "intra_day" | "d_to_d3" | "full";
  capacity_kwp: number;
  unit: "W" | "kW" | "MW";
}): Promise<SpatialSummaryResponse> {
  const query = new URLSearchParams({
    horizon: params.horizon,
    capacity_kwp: params.capacity_kwp.toString(),
    unit: params.unit,
  });
  const res = await fetch(`${API_BASE}/api/spatial/summary?${query.toString()}`);
  if (!res.ok) throw new Error("Échec de la récupération spatiale");
  return res.json();
}

export async function fetchDispatchPreview(params: {
  scale_level: "national" | "district" | "governorate";
  entity_name?: string;
  horizon: "intra_day" | "d_to_d3" | "full";
  capacity_kwp: number;
  unit: "W" | "kW" | "MW";
}): Promise<DispatchPreviewResponse> {
  const query = new URLSearchParams({
    scale_level: params.scale_level,
    horizon: params.horizon,
    capacity_kwp: params.capacity_kwp.toString(),
    unit: params.unit,
  });
  if (params.entity_name) {
    query.set("entity_name", params.entity_name);
  }

  const res = await fetch(`${API_BASE}/api/dispatch/preview?${query.toString()}`);
  if (!res.ok) throw new Error("Échec du chargement du tableau de dispatch");
  return res.json();
}

export async function fetchTelemetry(): Promise<TelemetryResponse> {
  const res = await fetch(`${API_BASE}/api/telemetry`);
  if (!res.ok) throw new Error("Échec de la télémétrie météo");
  return res.json();
}

export async function triggerForecastRefresh(
  days: number = 4,
  confidenceLevel: number = 90
): Promise<{ status: string; message: string; rows: number }> {
  const query = new URLSearchParams({
    days: days.toString(),
    confidence_level: (confidenceLevel / 100).toString(),
  });
  const res = await fetch(`${API_BASE}/api/forecast/refresh?${query.toString()}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Échec du rafraîchissement météo");
  return res.json();
}

export function getExportUrl(params: {
  format: "csv" | "json";
  scale_level: "national" | "district" | "governorate";
  entity_name?: string;
  horizon: "intra_day" | "d_to_d3" | "full";
  capacity_kwp: number;
  unit: "W" | "kW" | "MW";
}): string {
  const query = new URLSearchParams({
    format: params.format,
    scale_level: params.scale_level,
    horizon: params.horizon,
    capacity_kwp: params.capacity_kwp.toString(),
    unit: params.unit,
  });
  if (params.entity_name) {
    query.set("entity_name", params.entity_name);
  }
  return `${API_BASE}/api/dispatch/export?${query.toString()}`;
}

// ---------------------------------------------------------------------------
// Battery Module API Services
// ---------------------------------------------------------------------------

export async function loginUser(email: string, password: string): Promise<{ access_token: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/battery/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de connexion");
  }
  return res.json();
}

export async function registerUser(data: {
  email: string;
  password: string;
  full_name: string;
  role?: string;
  steg_contract_no?: string;
}): Promise<{ access_token: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/battery/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de l'enregistrement");
  }
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<{ status: string; message: string; reset_token?: string; email?: string }> {
  const res = await fetch(`${API_BASE}/api/battery/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de la demande de réinitialisation");
  }
  return res.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/battery/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de la réinitialisation du mot de passe");
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/battery/auth/me`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Non authentifié");
  return res.json();
}

export async function fetchPVProfile(): Promise<PVProfile> {
  const res = await fetch(`${API_BASE}/api/battery/profile`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Échec du chargement du profil PV");
  return res.json();
}

export async function savePVProfile(profile: PVProfile): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/battery/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Échec de sauvegarde du profil PV");
  return res.json();
}

export async function fetchBatteryCatalog(): Promise<BatteryItem[]> {
  const res = await fetch(`${API_BASE}/api/battery/catalog`);
  if (!res.ok) throw new Error("Échec du chargement du catalogue");
  return res.json();
}

export async function fetchCompatibleBatteries(): Promise<BatteryItem[]> {
  const res = await fetch(`${API_BASE}/api/battery/compatible`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Échec du chargement des batteries compatibles");
  return res.json();
}

export async function simulateBattery(batteryId: number, initialSocPct = 50.0): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/api/battery/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ battery_id: batteryId, initial_soc_pct: initialSocPct }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de la simulation de batterie");
  }
  return res.json();
}

export async function compareBatteries(batteryIds: number[]): Promise<{ comparisons: BatteryComparisonItem[] }> {
  const res = await fetch(`${API_BASE}/api/battery/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ battery_ids: batteryIds }),
  });
  if (!res.ok) throw new Error("Échec de la comparaison de batteries");
  return res.json();
}

export async function submitBatteryRequest(
  batteryId: number,
  appliances: ApplianceItem[] = [],
  documentRef = "Dossier_Technique_STEG.pdf"
): Promise<{ status: string; request_id: number; message: string }> {
  const res = await fetch(`${API_BASE}/api/battery/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      battery_id: batteryId,
      appliances: appliances,
      document_ref: documentRef,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Échec de la soumission de la demande");
  }
  return res.json();
}


export async function fetchMyRequests(): Promise<BatteryRequestItem[]> {
  const res = await fetch(`${API_BASE}/api/battery/requests/my`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Échec du chargement de vos demandes");
  return res.json();
}

export async function fetchAdminRequests(statusFilter?: string): Promise<BatteryRequestItem[]> {
  const url = statusFilter
    ? `${API_BASE}/api/battery/admin/requests?status_filter=${statusFilter}`
    : `${API_BASE}/api/battery/admin/requests`;
  const res = await fetch(url, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Échec du chargement des demandes administratives");
  return res.json();
}

export async function submitAdminDecision(
  requestId: number,
  status: "APPROVED" | "REJECTED" | "INFO_REQUESTED" | "UNDER_REVIEW",
  adminNotes?: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/battery/admin/requests/${requestId}/decision`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ status, admin_notes: adminNotes }),
  });
  if (!res.ok) throw new Error("Échec de mise à jour de la décision");
  return res.json();
}

export async function updateInstallationStage(
  requestId: number,
  data: {
    stage: string;
    installer_name?: string;
    scheduled_date?: string;
    commissioning_date?: string;
    steg_meter_ref?: string;
    notes?: string;
  }
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/battery/admin/tracking/${requestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Échec de mise à jour du suivi d'installation");
  return res.json();
}
