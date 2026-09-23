export interface KPIData {
  peak_power: number;
  display_unit: "W" | "kW" | "MW";
  total_energy: number;
  energy_unit: "kWh" | "MWh";
  avg_certitude: number;
  peak_gi: number;
}

export interface TimeSeriesItem {
  time: string;
  entity_name: string;
  power_forecast: number;
  power_lower_bound: number;
  power_upper_bound: number;
  certitude_pct: number;
  gi: number;
  t2m: number | null;
  unit: "W" | "kW" | "MW";
}

export interface ForecastResponse {
  kpis: KPIData;
  timeseries: TimeSeriesItem[];
  metadata: {
    records_count: number;
    scale_level: "national" | "district" | "governorate";
    entity_name: string;
    horizon: "intra_day" | "d_to_d3" | "full";
    capacity_kwp: number;
    confidence_level: number;
  };
}

export interface GovernorateSummary {
  governorate: string;
  district: string;
  latitude: number;
  longitude: number;
  peak_power: number;
  peak_gi: number;
  avg_cert: number;
}

export interface DistrictSummary {
  district: string;
  peak_power: number;
}

export interface SpatialSummaryResponse {
  governorates: GovernorateSummary[];
  districts: DistrictSummary[];
  unit: "W" | "kW" | "MW";
  capacity_kwp: number;
}

export interface DispatchRecord {
  time: string;
  scale_level: string;
  entity_name: string;
  power_forecast: number;
  power_lower_bound: number;
  power_upper_bound: number;
  unit: "W" | "kW" | "MW";
  certitude_pct: number;
  gi: number;
}

export interface DispatchPreviewResponse {
  records: DispatchRecord[];
  total: number;
  horizon: string;
  unit: string;
  capacity_kwp: number;
}

export interface TelemetryResponse {
  status: "HEALTHY" | "WARNING" | "DEGRADED" | "ERROR";
  latency_ms: number;
  variables_verified: boolean;
  physical_bounds_passed: boolean;
  timestamp: string;
  http_code: number;
}

export interface MetadataResponse {
  active_model: string;
  model_description: string;
  forbidden_models: string[];
  normalization_note: string;
  districts: string[];
  governorates: {
    name: string;
    district: string;
    lat: number;
    lon: number;
  }[];
}
