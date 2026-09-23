import {
  ForecastResponse,
  SpatialSummaryResponse,
  DispatchPreviewResponse,
  TelemetryResponse,
  MetadataResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
