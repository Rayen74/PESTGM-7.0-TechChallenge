"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { NormalizationBanner } from "@/components/NormalizationBanner";
import { KpiCards } from "@/components/KpiCards";
import { ForecastTab } from "@/components/tabs/ForecastTab";
import { MapTab } from "@/components/tabs/MapTab";
import { MonitorTab } from "@/components/tabs/MonitorTab";
import { DispatchTab } from "@/components/tabs/DispatchTab";
import {
  fetchForecast,
  fetchSpatialSummary,
  fetchDispatchPreview,
  fetchTelemetry,
  triggerForecastRefresh,
  getExportUrl,
  fetchAdminRequests,
  submitAdminDecision,
  updateInstallationStage,
  auditRequestWithAgent,
} from "@/lib/api";
import {
  ForecastResponse,
  SpatialSummaryResponse,
  DispatchPreviewResponse,
  TelemetryResponse,
  BatteryRequestItem,
  AgentAuditReport,
} from "@/lib/types";
import {
  BarChart3,
  Map,
  Zap,
  Activity,
  Loader2,
  ClipboardList,
  LogOut,
  CheckCircle2,
  XCircle,
  Info,
  Wrench,
  Check,
  X,
  Bot,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Gauge,
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { t, formatNumber, formatDate, isRtl, translateStatus, translateStage } = useI18n();

  // ---------- Auth guard ----------
  useEffect(() => {
    const sess = getSession();
    if (!sess || sess.role !== "ADMIN") {
      router.replace("/login");
    }
  }, [router]);

  const { logout: contextLogout } = useAuth();

  const handleLogout = () => {
    logout();
    if (contextLogout) contextLogout();
    window.location.href = "/login";
  };

  // ---------- Sidebar state ----------
  const [scaleType, setScaleType] = useState<
    "National (Agrégé)" | "District (Régional)" | "Gouvernorat (Local)"
  >("National (Agrégé)");
  const [selectedDistrict, setSelectedDistrict] = useState("Grand Tunis");
  const [selectedGov, setSelectedGov] = useState("Tunis");
  const [horizonChoice, setHorizonChoice] = useState<
    | "Intra-journalier (Aujourd'hui / 24h)"
    | "D à D+3 (Dispatch opérationnel / 96h)"
    | "Horizon Étendu (Jusqu'à D+16)"
  >("D à D+3 (Dispatch opérationnel / 96h)");
  const [capVal, setCapVal] = useState(1.0);
  const [capUnit, setCapUnit] = useState<"kWp" | "MWp">("kWp");
  const [ciLevel, setCiLevel] = useState(90);

  // ---------- Active Tab ----------
  const [activeTab, setActiveTab] = useState<
    "forecast" | "map" | "dispatch" | "monitor" | "requests"
  >("forecast");

  // ---------- API Data ----------
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

  // ---------- Battery requests ----------
  const [requests, setRequests] = useState<BatteryRequestItem[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // ---------- Derived params ----------
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
      ? "Tunisie"
      : scaleType === "District (Régional)"
      ? selectedDistrict
      : selectedGov;

  // ---------- Load forecast data ----------
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [fData, sData, dData, tData] = await Promise.all([
        fetchForecast({
          scale_level: scaleLevelCode as any,
          entity_name: entityName,
          horizon: horizonCode as any,
          capacity_kwp: capacityKwp,
          unit: displayUnit as any,
          confidence_level: ciLevel,
        }),
        fetchSpatialSummary({
          horizon: horizonCode as any,
          capacity_kwp: capacityKwp,
          unit: displayUnit as any,
        }),
        fetchDispatchPreview({
          scale_level: scaleLevelCode as any,
          entity_name: entityName,
          horizon: horizonCode as any,
          capacity_kwp: capacityKwp,
          unit: displayUnit as any,
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [scaleLevelCode, entityName, horizonCode, capacityKwp, displayUnit, ciLevel]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ---------- Load battery requests ----------
  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const filter = statusFilter === "ALL" ? undefined : statusFilter;
      const data = await fetchAdminRequests(filter);
      setRequests(data);
    } catch (e) {
      console.error(e);
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === "requests") {
      loadRequests();
    }
  }, [activeTab, loadRequests]);

  // ---------- Tracking Modal State ----------
  const [trackingModalReq, setTrackingModalReq] = useState<BatteryRequestItem | null>(null);
  const [trackingForm, setTrackingForm] = useState<{
    stage: string;
    installer_name: string;
    scheduled_date: string;
    commissioning_date: string;
    steg_meter_ref: string;
    notes: string;
  }>({
    stage: "APPROVED",
    installer_name: "",
    scheduled_date: "",
    commissioning_date: "",
    steg_meter_ref: "",
    notes: "",
  });
  const [updatingTracking, setUpdatingTracking] = useState(false);

  const openTrackingModal = (req: BatteryRequestItem) => {
    setTrackingModalReq(req);
    setTrackingForm({
      stage: req.tracking_stage || "APPROVED",
      installer_name: req.installer_name || "",
      scheduled_date: req.scheduled_date || "",
      commissioning_date: req.commissioning_date || "",
      steg_meter_ref: req.steg_meter_ref || "",
      notes: "",
    });
  };

  const closeTrackingModal = () => {
    setTrackingModalReq(null);
  };

  const handleUpdateTracking = async () => {
    if (!trackingModalReq) return;
    setUpdatingTracking(true);
    try {
      await updateInstallationStage(trackingModalReq.id, {
        stage: trackingForm.stage,
        installer_name: trackingForm.installer_name || undefined,
        scheduled_date: trackingForm.scheduled_date || undefined,
        commissioning_date: trackingForm.commissioning_date || undefined,
        steg_meter_ref: trackingForm.steg_meter_ref || undefined,
        notes: trackingForm.notes || undefined,
      });
      setToastMsg(
        t.adminRequests.toastUpdated
          .replace("{id}", trackingModalReq.id)
          .replace("{stage}", translateStage(trackingForm.stage))
      );
      setTimeout(() => setToastMsg(null), 3000);
      closeTrackingModal();
      await loadRequests();
    } catch (err: any) {
      setToastMsg(err.message || t.adminRequests.toastError);
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setUpdatingTracking(false);
    }
  };

  // ---------- AI Technical Agent Audit State ----------
  const [agentAuditModalReq, setAgentAuditModalReq] = useState<BatteryRequestItem | null>(null);
  const [auditReport, setAuditReport] = useState<AgentAuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleOpenAgentAudit = async (req: BatteryRequestItem) => {
    setAgentAuditModalReq(req);
    setAuditReport(null);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const report = await auditRequestWithAgent(req.id);
      setAuditReport(report);
    } catch (err: any) {
      setAuditError(err.message || t.adminRequests.auditErrorTitle);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleApplySuggestedDecision = async () => {
    if (!agentAuditModalReq || !auditReport) return;
    try {
      await submitAdminDecision(
        agentAuditModalReq.id,
        auditReport.suggested_decision,
        auditReport.suggested_reason
      );
      setToastMsg(
        t.adminRequests.toastDecisionApplied.replace(
          "{decision}",
          translateStatus(auditReport.suggested_decision)
        )
      );
      setTimeout(() => setToastMsg(null), 3000);
      setAgentAuditModalReq(null);
      await loadRequests();
    } catch (err: any) {
      setToastMsg(err.message || t.adminRequests.toastError);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleDecision = async (
    requestId: string,
    status: "APPROVED" | "REJECTED" | "INFO_REQUESTED"
  ) => {
    try {
      await submitAdminDecision(requestId, status);
      await loadRequests();
      setToastMsg(`Demande #${requestId} → ${translateStatus(status)}`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e) {
      console.error("Decision error", e);
    }
  };

  // ---------- Refresh handler ----------
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerForecastRefresh(4, ciLevel);
      setToastMsg(t.adminRequests.toastDataRefreshed);
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      setToastMsg(t.adminRequests.toastRefreshError);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // ---------- Dispatch download handlers ----------
  const handleDownloadDispatchCsv = () => {
    const url = getExportUrl({
      format: "csv",
      scale_level: scaleLevelCode as any,
      entity_name: entityName,
      horizon: horizonCode as any,
      capacity_kwp: capacityKwp,
      unit: displayUnit as any,
    });
    window.open(url, "_blank");
  };

  const handleDownloadDispatchJson = () => {
    const url = getExportUrl({
      format: "json",
      scale_level: scaleLevelCode as any,
      entity_name: entityName,
      horizon: horizonCode as any,
      capacity_kwp: capacityKwp,
      unit: displayUnit as any,
    });
    window.open(url, "_blank");
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "APPROVED":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "REJECTED":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "INFO_REQUESTED":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "UNDER_REVIEW":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const TABS = [
    { key: "forecast", icon: BarChart3, label: t.tabs.forecast },
    { key: "map", icon: Map, label: t.tabs.map },
    { key: "dispatch", icon: Zap, label: t.tabs.dispatch },
    { key: "monitor", icon: Activity, label: t.tabs.monitor },
    { key: "requests", icon: ClipboardList, label: t.tabs.requests },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* Header with horizontal items: Status, Logout, LanguageSelector */}
      <Header isHealthy={telemetry.status === "HEALTHY"}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.common.logout}</span>
        </button>
      </Header>

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-20 ${isRtl ? "left-6" : "right-6"} z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl animate-bounce`}>
          {toastMsg}
        </div>
      )}

      {/* Main Body */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Sidebar (only for forecast tabs) */}
        {activeTab !== "requests" && (
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
        )}

        {/* Dashboard Area */}
        <div className="flex-1 space-y-6 min-w-0">
          {activeTab !== "requests" && (
            <NormalizationBanner
              capacityVal={capVal}
              capacityUnit={capUnit}
              displayUnit={displayUnit}
            />
          )}

          {/* Tab bar */}
          <div className="flex border-b border-slate-800 gap-1 overflow-x-auto custom-scrollbar pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-amber-400 text-amber-400 bg-amber-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {loading && !forecastData && activeTab !== "requests" ? (
            <div className="glass-panel p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-sm text-slate-400">{t.common.loading}</p>
            </div>
          ) : (
            <>
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

              {activeTab === "map" && spatialData && (
                <MapTab
                  governorates={spatialData.governorates}
                  districts={spatialData.districts}
                  displayUnit={displayUnit}
                />
              )}

              {activeTab === "dispatch" && dispatchData && (
                <DispatchTab
                  records={dispatchData.records}
                  displayUnit={displayUnit}
                  onDownloadCsv={handleDownloadDispatchCsv}
                  onDownloadJson={handleDownloadDispatchJson}
                />
              )}

              {activeTab === "monitor" && (
                <MonitorTab
                  telemetry={telemetry}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                />
              )}

              {/* Battery Requests Tab */}
              {activeTab === "requests" && (
                <div className="space-y-4">
                  {/* Filter bar */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">{t.adminRequests.filterLabel}</span>
                    {["ALL", "SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          statusFilter === f
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {f === "ALL" ? t.adminRequests.filterAll : translateStatus(f)}
                      </button>
                    ))}
                  </div>

                  {reqLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="glass-panel p-12 text-center">
                      <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">{t.adminRequests.noRequests}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thId}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thCitizen}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thBattery}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thCapacity}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thAppliances}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thStatus}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thTracking}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thDate}</th>
                            <th className={`px-4 py-3 ${isRtl ? "text-right" : "text-left"}`}>{t.adminRequests.thActions}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {requests.map((req) => (
                            <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-3 font-mono text-amber-400">#{req.id}</td>
                              <td className="px-4 py-3">
                                <div className="text-slate-200 text-xs font-medium">{req.citizen_name || "—"}</div>
                                <div className="text-slate-500 text-xs font-mono">{req.citizen_email || "—"}</div>
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {req.battery_brand} {req.battery_model}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                                {formatNumber(req.usable_capacity_kwh, { maximumFractionDigits: 1 })} kWh
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {req.appliances && req.appliances.length > 0 ? (
                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-emerald-400">
                                      {t.adminRequests.appliancesCount.replace("{count}", formatNumber(req.appliances.length))}
                                    </span>
                                    <div className="text-[11px] text-slate-400 max-w-xs truncate">
                                      {req.appliances.map((a) => `${a.name} (${formatNumber(a.consumption_w)}W)`).join(", ")}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(req.status)}`}>
                                  {translateStatus(req.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {req.status === "APPROVED" ? (
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                      <Wrench className="w-3 h-3" />
                                      {translateStage(req.tracking_stage || "APPROVED")}
                                    </span>
                                    <button
                                      onClick={() => openTrackingModal(req)}
                                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 font-medium transition-colors cursor-pointer"
                                    >
                                      {t.adminRequests.manageTracking}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {formatDate(req.created_at)}
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenAgentAudit(req)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>{t.adminRequests.launchAiAudit}</span>
                                  </button>

                                  {(req.status === "SUBMITTED" || req.status === "UNDER_REVIEW") && (
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => handleDecision(req.id, "APPROVED")}
                                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                        title={t.adminRequests.btnApprove}
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDecision(req.id, "REJECTED")}
                                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                        title={t.adminRequests.btnReject}
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDecision(req.id, "INFO_REQUESTED")}
                                        className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                        title={t.adminRequests.btnRequestInfo}
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                  {req.status === "APPROVED" && (
                                    <button
                                      onClick={() => openTrackingModal(req)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors cursor-pointer"
                                    >
                                      <Wrench className="w-3 h-3" />
                                      <span>{t.adminRequests.btnTracking}</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ============ INSTALLATION TRACKING MODAL ============ */}
      {trackingModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {t.adminRequests.trackingModalTitle}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                  {t.adminRequests.trackingModalHeader
                    .replace("{id}", trackingModalReq.id)
                    .replace("{brand}", trackingModalReq.battery_brand)
                    .replace("{model}", trackingModalReq.battery_model)}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t.adminRequests.trackingCitizenLabel} <strong className="text-slate-200">{trackingModalReq.citizen_name || trackingModalReq.citizen_email}</strong>
                  {trackingModalReq.steg_contract_no ? ` · ${t.adminRequests.trackingPoliceLabel} ${trackingModalReq.steg_contract_no}` : ""}
                </p>
              </div>
              <button
                onClick={closeTrackingModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper visual preview */}
            <div className="py-4 border-b border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                {t.adminRequests.lifecycleStage}
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  { key: "APPROVED", label: t.adminRequests.stageApproved },
                  { key: "INSTALLATION_SCHEDULED", label: t.adminRequests.stageScheduled },
                  { key: "INSTALLING", label: t.adminRequests.stageInstalling },
                  { key: "COMMISSIONING", label: t.adminRequests.stageCommissioning },
                  { key: "ACTIVE", label: t.adminRequests.stageActive },
                ].map((s, idx) => {
                  const stages = ["APPROVED", "INSTALLATION_SCHEDULED", "INSTALLING", "COMMISSIONING", "ACTIVE"];
                  const currentIdx = stages.indexOf(trackingForm.stage);
                  const isCurrent = trackingForm.stage === s.key;
                  const isPast = idx < currentIdx;

                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setTrackingForm((prev) => ({ ...prev, stage: s.key }))}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10"
                          : isPast
                          ? "bg-slate-800/50 border-emerald-500/30 text-emerald-400/80"
                          : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <div className="text-[10px] font-mono text-slate-400">
                        {t.common.step} {formatNumber(idx + 1)}
                      </div>
                      <div className="text-xs font-semibold mt-0.5 leading-tight">{s.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {t.adminRequests.currentStageLabel}
                </label>
                <select
                  value={trackingForm.stage}
                  onChange={(e) => setTrackingForm((prev) => ({ ...prev, stage: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="APPROVED">{t.adminRequests.optApproved}</option>
                  <option value="INSTALLATION_SCHEDULED">{t.adminRequests.optScheduled}</option>
                  <option value="INSTALLING">{t.adminRequests.optInstalling}</option>
                  <option value="COMMISSIONING">{t.adminRequests.optCommissioning}</option>
                  <option value="ACTIVE">{t.adminRequests.optActive}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {t.adminRequests.installerNameLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.adminRequests.installerNamePlaceholder}
                  value={trackingForm.installer_name}
                  onChange={(e) => setTrackingForm((prev) => ({ ...prev, installer_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-left rtl:text-right"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    {t.adminRequests.scheduledDateLabel}
                  </label>
                  <input
                    type="date"
                    value={trackingForm.scheduled_date}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    {t.adminRequests.commissioningDateLabel}
                  </label>
                  <input
                    type="date"
                    value={trackingForm.commissioning_date}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, commissioning_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {t.adminRequests.meterRefLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.adminRequests.meterRefPlaceholder}
                  value={trackingForm.steg_meter_ref}
                  onChange={(e) => setTrackingForm((prev) => ({ ...prev, steg_meter_ref: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-left rtl:text-right font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {t.adminRequests.notesLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.adminRequests.notesPlaceholder}
                  value={trackingForm.notes}
                  onChange={(e) => setTrackingForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-left rtl:text-right"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeTrackingModal}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.common.cancel}
              </button>

              <button
                type="button"
                onClick={handleUpdateTracking}
                disabled={updatingTracking}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
              >
                {updatingTracking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {updatingTracking ? t.adminRequests.savingStage : t.adminRequests.saveStage}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          AI TECHNICAL AGENT AUDIT MODAL
         ========================================================================= */}
      {agentAuditModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl shadow-indigo-950/50 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">
                      {t.adminRequests.auditModalTitle.replace("{id}", agentAuditModalReq.id)}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      <Sparkles className="w-3 h-3" />
                      {t.adminRequests.agenticAiTag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {t.adminRequests.trackingCitizenLabel} {agentAuditModalReq.citizen_name || "—"} • {t.adminRequests.auditContractLabel} {agentAuditModalReq.steg_contract_no || "—"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAgentAuditModalReq(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loading state */}
            {auditLoading && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <Bot className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    {t.adminRequests.auditOrchestrating}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {t.adminRequests.auditOrchestratingDesc}
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {auditError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{t.adminRequests.auditErrorTitle}</p>
                  <p>{auditError}</p>
                </div>
              </div>
            )}

            {/* Audit Content */}
            {!auditLoading && auditReport && (
              <div className="space-y-5">
                {/* Score & Verdict Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl font-black text-sm font-mono ${auditReport.score >= 80 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : auditReport.score >= 60 ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
                      {formatNumber(auditReport.score)}/100
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 uppercase font-semibold">{t.adminRequests.technicalScore}</div>
                      <div className="text-xs font-bold text-slate-200">
                        {auditReport.score >= 80 ? t.adminRequests.scoreExcellent : auditReport.score >= 60 ? t.adminRequests.scoreModerate : t.adminRequests.scoreCritical}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${auditReport.compatibility_verdict === "PASSED" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                      {auditReport.compatibility_verdict === "PASSED" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 uppercase font-semibold">{t.adminRequests.hardwareCompatibility}</div>
                      <div className="text-xs font-bold text-slate-200">
                        {auditReport.compatibility_verdict === "PASSED" ? t.adminRequests.compatPassed : t.adminRequests.compatFailed}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 uppercase font-semibold">{t.adminRequests.selfConsumption}</div>
                      <div className="text-xs font-bold text-indigo-300 font-mono">
                        {formatNumber(auditReport.simulation_kpis.self_consumption_pct, { maximumFractionDigits: 1 })}% ({t.adminRequests.autonomy} {formatNumber(auditReport.simulation_kpis.self_sufficiency_pct, { maximumFractionDigits: 1 })}%)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sizing & Grid Impact */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t.adminRequests.requestedBattery}</span>
                    <span className="font-semibold text-slate-200">{auditReport.battery_selected}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t.adminRequests.storageRatio}</span>
                    <span className="font-semibold text-amber-400 font-mono">
                      {formatNumber(auditReport.sizing_ratio, { maximumFractionDigits: 2 })} kWh/kWp {t.adminRequests.recommendedRatio}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t.adminRequests.stegGridImpact}</span>
                    <span className="font-medium text-emerald-400">{auditReport.grid_impact_label}</span>
                  </div>
                </div>

                {/* Technical Findings */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                    {t.adminRequests.technicalFindingsTitle}
                  </h4>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    {auditReport.technical_findings.map((f, i) => (
                      <p key={i} className="leading-relaxed">{f}</p>
                    ))}
                  </div>
                </div>

                {/* LLM Commentary if available */}
                {auditReport.llm_commentary && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      {t.adminRequests.aiEngineerReview}
                    </div>
                    <p className="text-xs text-indigo-200/90 italic leading-relaxed">
                      &ldquo;{auditReport.llm_commentary}&rdquo;
                    </p>
                  </div>
                )}

                {/* Better alternative notice if present */}
                {auditReport.better_alternative && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        {t.adminRequests.betterAlternativeTitle} <strong>{auditReport.better_alternative.name}</strong>{" "}
                        {t.adminRequests.betterGain.replace("{gain}", formatNumber(auditReport.better_alternative.gain_pct, { maximumFractionDigits: 1 }))}.
                      </span>
                    </div>
                  </div>
                )}

                {/* Suggested Decision & 1-Click Action */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                        {t.adminRequests.agentRecommendationForDistrict}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full text-xs font-bold border ${auditReport.suggested_decision === "APPROVED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : auditReport.suggested_decision === "REJECTED" ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40"}`}>
                        {auditReport.suggested_decision === "APPROVED" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {auditReport.suggested_decision === "REJECTED" && <XCircle className="w-3.5 h-3.5" />}
                        {auditReport.suggested_decision === "INFO_REQUESTED" && <Info className="w-3.5 h-3.5" />}
                        {translateStatus(auditReport.suggested_decision)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplySuggestedDecision}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:brightness-110 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      {t.adminRequests.applyDecision}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 italic">
                    {t.adminRequests.prefilledReason} {auditReport.suggested_reason}
                  </p>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setAgentAuditModalReq(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.adminRequests.closeAudit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
