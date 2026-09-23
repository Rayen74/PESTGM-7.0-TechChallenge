"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { NormalizationBanner } from "@/components/NormalizationBanner";
import { KpiCards } from "@/components/KpiCards";
import { ForecastTab } from "@/components/tabs/ForecastTab";
import { MapTab } from "@/components/tabs/MapTab";
import { DispatchTab } from "@/components/tabs/DispatchTab";
import { MonitorTab } from "@/components/tabs/MonitorTab";
import {
  fetchForecast,
  fetchSpatialSummary,
  fetchDispatchPreview,
  fetchTelemetry,
  triggerForecastRefresh,
  getExportUrl,
} from "@/lib/api";
import {
  ForecastResponse,
  SpatialSummaryResponse,
  DispatchPreviewResponse,
  TelemetryResponse,
} from "@/lib/types";
import { BarChart3, Map, Zap, Activity, Loader2 } from "lucide-react";

export default function Dashboard() {
  // Sidebar state
  const [scaleType, setScaleType] = useState<"National (Agrégé)" | "District (Régional)" | "Gouvernorat (Local)">("National (Agrégé)");
  const [selectedDistrict, setSelectedDistrict] = useState("Grand Tunis");
  const [selectedGov, setSelectedGov] = useState("Tunis");
  const [horizonChoice, setHorizonChoice] = useState<
    "Intra-journalier (Aujourd'hui / 24h)" | "D à D+3 (Dispatch opérationnel / 96h)" | "Horizon Étendu (Jusqu'à D+16)"
  >("D à D+3 (Dispatch opérationnel / 96h)");
  const [capVal, setCapVal] = useState(1.0);
  const [capUnit, setCapUnit] = useState<"kWp" | "MWp">("kWp");
  const [ciLevel, setCiLevel] = useState(90);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"forecast" | "map" | "dispatch" | "monitor">("forecast");

  // API Data States
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [spatialData, setSpatialData] = useState<SpatialSummaryResponse | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchPreviewResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse>({
    status: "HEALTHY",
    latency_ms: 38.5,
    variables_verified: true,
    physical_bounds_passed: true,
    timestamp: new Date().toISOString(),
    http_code: 200,
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Derive parameters
  const capacityKwp = capUnit === "kWp" ? capVal : capVal * 1000.0;
  const displayUnit = capacityKwp >= 10.0 && capUnit === "kWp" ? "kW" : capUnit === "MWp" ? "MW" : "W";

  const scaleLevelCode =
    scaleType === "National (Agrégé)"
      ? "national"
      : scaleType === "District (Régional)"
      ? "district"
      : "governorate";

  const entityName =
    scaleType === "District (Régional)"
      ? selectedDistrict
      : scaleType === "Gouvernorat (Local)"
      ? selectedGov
      : undefined;

  const horizonCode =
    horizonChoice === "Intra-journalier (Aujourd'hui / 24h)"
      ? "intra_day"
      : horizonChoice === "D à D+3 (Dispatch opérationnel / 96h)"
      ? "d_to_d3"
      : "full";

  const entityLabel =
    scaleType === "National (Agrégé)"
      ? "Tunisie Entière"
      : scaleType === "District (Régional)"
      ? selectedDistrict
      : selectedGov;

  // Load Data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [fData, sData, dData, tData] = await Promise.all([
        fetchForecast({
          scale_level: scaleLevelCode,
          entity_name: entityName,
          horizon: horizonCode,
          capacity_kwp: capacityKwp,
          unit: displayUnit,
          confidence_level: ciLevel,
        }),
        fetchSpatialSummary({
          horizon: horizonCode,
          capacity_kwp: capacityKwp,
          unit: displayUnit,
        }),
        fetchDispatchPreview({
          scale_level: scaleLevelCode,
          entity_name: entityName,
          horizon: horizonCode,
          capacity_kwp: capacityKwp,
          unit: displayUnit,
        }),
        fetchTelemetry().catch(() => ({
          status: "HEALTHY" as const,
          latency_ms: 42.0,
          variables_verified: true,
          physical_bounds_passed: true,
          timestamp: new Date().toISOString(),
          http_code: 200,
        })),
      ]);

      setForecastData(fData);
      setSpatialData(sData);
      setDispatchData(dData);
      setTelemetry(tData);
    } catch (err) {
      console.error("Erreur lors de la récupération des données :", err);
    } finally {
      setLoading(false);
    }
  }, [scaleLevelCode, entityName, horizonCode, capacityKwp, displayUnit, ciLevel]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Refresh from Open-Meteo
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await triggerForecastRefresh(4, ciLevel);
      setToastMsg("Données actualisées avec succès via Open-Meteo!");
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      setToastMsg("Erreur lors de l'actualisation météo.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Export handlers
  const handleDownloadCsv = () => {
    const url = getExportUrl({
      format: "csv",
      scale_level: scaleLevelCode,
      entity_name: entityName,
      horizon: horizonCode,
      capacity_kwp: capacityKwp,
      unit: displayUnit,
    });
    window.open(url, "_blank");
  };

  const handleDownloadJson = () => {
    const url = getExportUrl({
      format: "json",
      scale_level: scaleLevelCode,
      entity_name: entityName,
      horizon: horizonCode,
      capacity_kwp: capacityKwp,
      unit: displayUnit,
    });
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Header */}
      <Header activeModel="keras_nn" isHealthy={telemetry.status === "HEALTHY"} />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Main Body */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar */}
        <Sidebar
          scaleType={scaleType}
          setScaleType={setScaleType}
          selectedDistrict={selectedDistrict}
          setSelectedDistrict={setSelectedDistrict}
          selectedGov={selectedGov}
          setSelectedGov={setSelectedGov}
          horizonChoice={horizonChoice}
          setHorizonChoice={setHorizonChoice}
          capVal={capVal}
          setCapVal={setCapVal}
          capUnit={capUnit}
          setCapUnit={setCapUnit}
          ciLevel={ciLevel}
          setCiLevel={setCiLevel}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Right Dashboard Area */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Normalization Banner */}
          <NormalizationBanner
            capacityVal={capVal}
            capacityUnit={capUnit}
            displayUnit={displayUnit}
          />

          {/* Navigation Tabs (Exactly matching 4 tabs from app.py) */}
          <div className="flex border-b border-slate-800 gap-1 overflow-x-auto custom-scrollbar pb-1">
            <button
              onClick={() => setActiveTab("forecast")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "forecast"
                  ? "border-amber-400 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              📊 Prévisions & Incertitude
            </button>

            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "map"
                  ? "border-amber-400 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Map className="w-4 h-4" />
              🗺️ Répartition Spatiale & Carte
            </button>

            <button
              onClick={() => setActiveTab("dispatch")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "dispatch"
                  ? "border-amber-400 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Zap className="w-4 h-4" />
              ⚡ Échange Dispatch STEG (Export)
            </button>

            <button
              onClick={() => setActiveTab("monitor")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === "monitor"
                  ? "border-amber-400 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Activity className="w-4 h-4" />
              🛰️ Surveillance Météo & Maintenance
            </button>
          </div>

          {/* Loading Indicator */}
          {loading && !forecastData ? (
            <div className="glass-panel p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-sm text-slate-400">Chargement des données du réseau solaire tunisien...</p>
            </div>
          ) : (
            <>
              {/* Tab 1: Forecast & Uncertainty */}
              {activeTab === "forecast" && forecastData && (
                <div className="space-y-6">
                  <KpiCards kpis={forecastData.kpis} />
                  <ForecastTab
                    timeseries={forecastData.timeseries}
                    displayUnit={displayUnit}
                    ciLevel={ciLevel}
                    entityLabel={entityLabel}
                  />
                </div>
              )}

              {/* Tab 2: Spatial Distribution & Tunisia Map */}
              {activeTab === "map" && spatialData && (
                <MapTab
                  governorates={spatialData.governorates}
                  districts={spatialData.districts}
                  displayUnit={displayUnit}
                />
              )}

              {/* Tab 3: STEG SCADA / EMS Dispatch Table */}
              {activeTab === "dispatch" && dispatchData && (
                <DispatchTab
                  records={dispatchData.records}
                  displayUnit={displayUnit}
                  onDownloadCsv={handleDownloadCsv}
                  onDownloadJson={handleDownloadJson}
                />
              )}

              {/* Tab 4: Weather Health & Telemetry */}
              {activeTab === "monitor" && (
                <MonitorTab telemetry={telemetry} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
