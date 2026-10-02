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

export interface RiskAssessment {
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_reason: string;
  expected_value: number;
  lower_value: number;
  upper_value: number;
  certitude_pct: number;
  conservative_value: number;
  possible_shortfall: number;
  recommended_grid_reserve_pct: number;
  dispatch_recommendation: string;
  battery_reserve_advice: string;
  charging_guidance: string;
  discharging_guidance: string;
  human_review_required: boolean;
  provisional: boolean;
  weather: {
    available: boolean;
    cloud_cover_pct?: number | null;
    rain_mm?: number | null;
    wind_mps?: number | null;
    variability?: "LOW" | "MEDIUM" | "HIGH" | null;
    factors: string[];
    message?: string;
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

// ---------------------------------------------------------------------------
// Battery Module Interfaces
// ---------------------------------------------------------------------------

export type UserRole = "CITIZEN" | "ADMIN";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  steg_contract_no?: string;
}

export interface PVProfile {
  id?: string;
  user_id?: string;
  pv_capacity_kwp: number;
  governorate: string;
  inverter_brand: string;
  inverter_model: string;
  inverter_type: "HYBRID" | "STRING";
  inverter_rated_power_kw: number;
  battery_bus_type: "LV_48V" | "HV";
  consumption_archetype: string;
  annual_consumption_kwh: number;
  is_created?: boolean;
}

export interface BatteryItem {
  id: string;
  brand: string;
  model: string;
  chemistry: string;
  nominal_capacity_kwh: number;
  usable_capacity_kwh: number;
  nominal_voltage_v: number;
  voltage_type: "LV_48V" | "HV";
  max_charge_kw: number;
  max_discharge_kw: number;
  round_trip_eff: number;
  dod_pct: number;
  coupling_type: string;
  compatible_inverters: string[];
  datasheet_url?: string;
  steg_certified: number;
  is_compatible?: boolean;
  compatibility_notes?: string[];
}

export interface SimulationTimelinePoint {
  hour: number;
  pv_generation_kw: number;
  load_consumption_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  grid_export_kw: number;
  grid_import_kw: number;
  battery_soc_pct: number;
  battery_soc_kwh: number;
}

export interface SimulationKPIs {
  self_consumption_pct: number;
  self_sufficiency_pct: number;
  self_sufficiency_gain_pct: number;
  grid_dependency_pct: number;
  total_solar_kwh: number;
  total_demand_kwh: number;
  total_charged_kwh: number;
  total_discharged_kwh: number;
  total_grid_import_kwh: number;
  total_grid_export_kwh: number;
  backup_autonomy_hours: number;
  estimated_savings_tnd: number;
}

export interface SimulationResult {
  kpis: SimulationKPIs;
  timeline: SimulationTimelinePoint[];
  battery_info: {
    brand: string;
    model: string;
    usable_capacity_kwh: number;
    chemistry: string;
  };
  profile: {
    pv_capacity_kwp: number;
    governorate: string;
    inverter_brand: string;
    inverter_model: string;
  };
}

export interface BatteryComparisonItem {
  battery_id: string;
  brand: string;
  model: string;
  nominal_capacity_kwh: number;
  usable_capacity_kwh: number;
  voltage_type: string;
  kpis: SimulationKPIs;
}

export interface ApplianceItem {
  name: string;
  consumption_w: number;
  quantity?: number;
  hours_per_day?: number;
}

export interface BatteryRequestItem {
  id: string;
  user_id: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "INFO_REQUESTED" | "APPROVED" | "REJECTED";
  admin_notes?: string;
  document_ref?: string;
  appliances?: ApplianceItem[];
  created_at: string;
  updated_at: string;
  battery_brand: string;
  battery_model: string;
  usable_capacity_kwh: number;
  voltage_type?: string;
  citizen_name?: string;
  citizen_email?: string;
  steg_contract_no?: string;
  profile_snapshot?: any;
  simulation_results?: any;
  tracking_stage?: "APPROVED" | "INSTALLATION_SCHEDULED" | "INSTALLING" | "COMMISSIONING" | "ACTIVE";
  installer_name?: string;
  scheduled_date?: string;
  commissioning_date?: string;
  steg_meter_ref?: string;
}

export interface AgentAuditReport {
  request_id: string;
  citizen_name: string;
  steg_contract_no?: string;
  battery_selected: string;
  score: number;
  compatibility_verdict: "PASSED" | "FAILED";
  sizing_ratio: number;
  grid_impact: "HIGH_BENEFIT" | "MODERATE_BENEFIT" | "LOW_BENEFIT";
  grid_impact_label: string;
  suggested_decision: "APPROVED" | "REJECTED" | "INFO_REQUESTED";
  suggested_reason: string;
  llm_commentary?: string | null;
  technical_findings: string[];
  simulation_kpis: {
    self_consumption_pct: number;
    self_sufficiency_pct: number;
    grid_import_kwh: number;
    grid_export_kwh: number;
    curtailment_prevented_kwh: number;
  };
  better_alternative?: {
    battery_id: string;
    name: string;
    self_sufficiency_pct: number;
    gain_pct: number;
  } | null;
  agent_version: string;
}

export interface AgentRecommendation {
  has_recommendation: boolean;
  message?: string;
  recommended_battery?: {
    battery_id: string;
    brand: string;
    model: string;
    usable_capacity_kwh: number;
    voltage_type: string;
    self_consumption_pct: number;
    self_sufficiency_pct: number;
    backup_autonomy_hours: number;
  };
  reasoning?: string[];
  all_compatible?: any[];
}

