"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  fetchBatteryCatalog,
  fetchMyRequests,
  submitBatteryRequest,
  fetchPVProfile,
  savePVProfile,
  getAgentRecommendation,
  fetchForecast,
  fetchMetadata,
} from "@/lib/api";
import { BatteryItem, BatteryRequestItem, ApplianceItem, AgentRecommendation, ForecastResponse } from "@/lib/types";
import { CitizenRiskTab } from "@/components/tabs/CitizenRiskTab";
import { ForecastTab } from "@/components/tabs/ForecastTab";
import { KpiCards } from "@/components/KpiCards";
import {
  Sun,
  LogOut,
  Battery,
  ClipboardList,
  Home,
  Loader2,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  BatteryCharging,
  ShieldCheck,
  Plus,
  Trash2,
  Tv,
  Check,
  X,
  Wrench,
  Bot,
  Sparkles,
  BarChart3,
} from "lucide-react";

type CitizenTab = "home" | "forecast" | "risk" | "catalog" | "requests";
type HorizonCode = "intra_day" | "d_to_d3" | "full";

export default function CitizenDashboard() {
  const router = useRouter();
  const { t, formatNumber, formatDate, isRtl, translateStatus, translateStage } = useI18n();
  const [sess, setSess] = useState<{ email: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<CitizenTab>("forecast");

  // ---------- Data ----------
  const [batteries, setBatteries] = useState<BatteryItem[]>([]);
  const [myRequests, setMyRequests] = useState<BatteryRequestItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [pvProfile, setPvProfile] = useState<any>(null);
  const [citizenForecast, setCitizenForecast] = useState<ForecastResponse | null>(null);
  const [riskCoordinates, setRiskCoordinates] = useState<{ latitude?: number; longitude?: number }>({});
  const [forecastDate, setForecastDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [forecastHorizon, setForecastHorizon] = useState<HorizonCode>("d_to_d3");
  const [governorates, setGovernorates] = useState<{ name: string; lat: number; lon: number }[]>([]);

  // ---------- Auth ----------
  useEffect(() => {
    const s = getSession();
    const token = typeof window !== "undefined" ? localStorage.getItem("steg_solar_token") : null;
    if (!s || s.role !== "CITIZEN" || !token) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("session");
        localStorage.removeItem("steg_solar_token");
      }
      router.replace("/login");
    } else {
      setSess(s);
      (async () => {
        try {
          const profile = await fetchPVProfile();
          if (profile && !(profile as any).is_created) {
            const { is_created, ...profileData } = profile as any;
            await savePVProfile(profileData);
          }
          setPvProfile(profile);
          const metadata = await fetchMetadata().catch(() => null);
          if (metadata) setGovernorates(metadata.governorates);
          const location = metadata?.governorates.find((g) => g.name === profile?.governorate);
          if (location) setRiskCoordinates({ latitude: location.lat, longitude: location.lon });
          setProfileReady(true);
        } catch (err: any) {
          if (err?.message?.includes("401") || err?.message?.includes("Non authentifié")) {
            logout();
            router.replace("/login");
            return;
          }
          setProfileReady(true);
        }
      })();
    }
  }, [router]);

  const { logout: contextLogout } = useAuth();

  const handleLogout = () => {
    logout();
    if (contextLogout) contextLogout();
    window.location.href = "/login";
  };

  // ---------- Load data ----------
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const data = await fetchBatteryCatalog();
      setBatteries(data);
    } catch {
      setBatteries([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const data = await fetchMyRequests();
      setMyRequests(data);
    } catch (err: any) {
      if (err?.message?.includes("401") || err?.message?.includes("Non authentifié")) {
        logout();
        router.replace("/login");
        return;
      }
      setMyRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [router]);

  useEffect(() => {
    if (!sess) return;
    loadRequests();
    if (activeTab === "catalog") loadCatalog();
    if (activeTab === "requests") loadRequests();
  }, [activeTab, sess, loadCatalog, loadRequests]);

  useEffect(() => {
    if (!sess || !pvProfile?.governorate) return;
    fetchForecast({
      scale_level: "governorate",
      entity_name: pvProfile.governorate,
      horizon: forecastHorizon,
      forecast_date: forecastDate,
      capacity_kwp: Number(pvProfile.pv_capacity_kwp || 1),
      unit: "kW",
      confidence_level: 90,
    }).then(setCitizenForecast).catch(() => setCitizenForecast(null));
  }, [sess, pvProfile, forecastDate, forecastHorizon]);

  // ---------- AI Recommendation State ----------
  const [aiRecommendation, setAiRecommendation] = useState<AgentRecommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [aiRecError, setAiRecError] = useState(false);

  const loadAiRecommendation = useCallback(async () => {
    setLoadingRecommendation(true);
    setAiRecError(false);
    try {
      const rec = await getAgentRecommendation([]);
      setAiRecommendation(rec);
    } catch (err: any) {
      if (err?.message?.includes("401") || err?.message?.includes("Non authentifié")) {
        logout();
        router.replace("/login");
        return;
      }
      setAiRecommendation(null);
      setAiRecError(true);
    } finally {
      setLoadingRecommendation(false);
    }
  }, [router]);

  useEffect(() => {
    if (activeTab === "catalog" && !aiRecommendation && !loadingRecommendation && !aiRecError && sess) {
      loadAiRecommendation();
    }
  }, [activeTab, aiRecommendation, loadingRecommendation, aiRecError, sess, loadAiRecommendation]);

  // ---------- Appliance Modal State ----------
  const [selectedBattery, setSelectedBattery] = useState<BatteryItem | null>(null);
  const [appliances, setAppliances] = useState<ApplianceItem[]>([
    { name: t.citizen.presetFridge, consumption_w: 150, quantity: 1, hours_per_day: 24 }
  ]);

  const openApplianceModal = (battery: BatteryItem) => {
    setSelectedBattery(battery);
    setAppliances([
      { name: t.citizen.presetFridge, consumption_w: 150, quantity: 1, hours_per_day: 24 }
    ]);
  };

  const closeApplianceModal = () => {
    setSelectedBattery(null);
  };

  const addApplianceRow = () => {
    setAppliances((prev) => [
      ...prev,
      { name: "", consumption_w: 100, quantity: 1, hours_per_day: 4 }
    ]);
  };

  const updateApplianceRow = (index: number, field: keyof ApplianceItem, val: any) => {
    setAppliances((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const removeApplianceRow = (index: number) => {
    setAppliances((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const addPresetAppliance = (name: string, watts: number, hours: number) => {
    setAppliances((prev) => [
      ...prev,
      { name, consumption_w: watts, quantity: 1, hours_per_day: hours }
    ]);
  };

  // ---------- Submit request with appliances ----------
  const handleConfirmApplication = async () => {
    if (!selectedBattery) return;
    const bId = selectedBattery.id;
    setSubmitting(bId);
    try {
      if (!profileReady) {
        try {
          const profile = await fetchPVProfile();
          if (profile && !(profile as any).is_created) {
            const { is_created, ...profileData } = profile as any;
            await savePVProfile(profileData);
          }
        } catch { /* proceed */ }
      }

      const validAppliances = appliances
        .filter((a) => a.name.trim() !== "" && a.consumption_w > 0)
        .map((a) => ({
          name: a.name.trim(),
          consumption_w: Number(a.consumption_w),
          quantity: Math.max(1, Number(a.quantity || 1)),
          hours_per_day: a.hours_per_day ? Number(a.hours_per_day) : undefined,
        }));

      await submitBatteryRequest(bId, validAppliances);
      setToast(t.citizen.requestSuccessToast);
      setTimeout(() => setToast(null), 3500);
      closeApplianceModal();
      setActiveTab("requests");
      loadRequests();
    } catch (err: any) {
      setToast(err.message || t.adminRequests.toastError);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(null);
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "APPROVED": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "REJECTED": return <XCircle className="w-4 h-4 text-rose-400" />;
      case "INFO_REQUESTED": return <Info className="w-4 h-4 text-amber-400" />;
      default: return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "APPROVED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "REJECTED": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "INFO_REQUESTED": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default: return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
  };

  const TABS: { key: CitizenTab; icon: React.ElementType; label: string }[] = [
    { key: "home", icon: Home, label: t.citizen.tabHome },
    { key: "forecast", icon: BarChart3, label: t.tabs.forecast },
    { key: "risk", icon: ShieldCheck, label: "Risk & guidance" },
    { key: "catalog", icon: Battery, label: t.citizen.tabCatalog },
    { key: "requests", icon: ClipboardList, label: t.citizen.tabRequests },
  ];

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;
  const activeBattery = myRequests.some((request) => request.tracking_stage === "ACTIVE");

  const handleLocationChange = async (governorate: string) => {
    if (!pvProfile) return;
    const nextProfile = { ...pvProfile, governorate };
    delete nextProfile.is_created;
    setPvProfile(nextProfile);
    const location = governorates.find((item) => item.name === governorate);
    setRiskCoordinates(location ? { latitude: location.lat, longitude: location.lon } : {});
    try {
      await savePVProfile(nextProfile);
    } catch (err: any) {
      setToast(err?.message || "Unable to save the selected location.");
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* ---- Header ---- */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sun className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
                {t.citizen.portalTitle}
              </h1>
              <p className="text-[10px] text-slate-500">{t.citizen.portalSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-xs text-slate-500 hidden sm:block font-mono">{sess?.email}</span>
            <LanguageSelector compact />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.common.logout}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 ${isRtl ? "left-6" : "right-6"} z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl animate-bounce`}>
          {toast}
        </div>
      )}

      {/* ---- Navigation ---- */}
      <nav className="border-b border-slate-800/60 bg-slate-900/30">
        <div className="max-w-6xl mx-auto flex gap-1 px-4 sm:px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-emerald-400 text-emerald-400 bg-emerald-500/5"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ---- Content ---- */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1">
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-sm font-bold text-slate-100">Forecast date and horizon</h2><p className="mt-1 text-xs text-slate-500">Choose the starting date and forecast period.</p></div>
            <label className="text-xs font-semibold text-slate-300">Date<input type="date" value={forecastDate} onChange={(event) => setForecastDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200" /></label>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">{([["intra_day", t.sidebar.horizonIntraDay], ["d_to_d3", t.sidebar.horizonD3], ["full", t.sidebar.horizonExtended]] as const).map(([code, label]) => (<label key={code} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${forecastHorizon === code ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-transparent text-slate-400"}`}><input type="radio" name="citizenForecastHorizon" checked={forecastHorizon === code} onChange={() => setForecastHorizon(code)} className="accent-emerald-500" />{label}</label>))}</div>
        </div>
        {/* ============ HOME ============ */}
        {activeTab === "home" && (
          <div className="space-y-8">
            {/* Welcome banner */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-slate-100 mb-2">
                  {t.citizen.welcomeTitle.replace("{name}", sess?.email?.split("@")[0] || "")}
                </h2>
                <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                  {t.citizen.welcomeSubtitle}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <label htmlFor="citizen-location" className="block text-sm font-semibold text-slate-100">
                Forecast location
              </label>
              <p className="mt-1 text-xs text-slate-500">Choose the governorate where your solar installation is located.</p>
              <select
                id="citizen-location"
                value={pvProfile?.governorate || ""}
                onChange={(event) => handleLocationChange(event.target.value)}
                disabled={!pvProfile || governorates.length === 0}
                className="mt-3 w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
              >
                <option value="" disabled>Select a governorate</option>
                {governorates.map((governorate) => (
                  <option key={governorate.name} value={governorate.name}>{governorate.name}</option>
                ))}
              </select>
            </div>

            {citizenForecast && (
              <div className="space-y-6">
                <KpiCards kpis={citizenForecast.kpis} />
                <ForecastTab
                  timeseries={citizenForecast.timeseries}
                  displayUnit="kW"
                  ciLevel={90}
                  entityLabel={pvProfile?.governorate || "your area"}
                />
              </div>
            )}

            {/* Quick action cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab("catalog")}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 p-6 text-left rtl:text-right transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <BatteryCharging className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1 flex items-center justify-between">
                  <span>{t.citizen.cardCatalogTitle}</span>
                  <ChevronIcon className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.citizen.cardCatalogDesc}
                </p>
              </button>

              <button
                onClick={() => setActiveTab("requests")}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 p-6 text-left rtl:text-right transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1 flex items-center justify-between">
                  <span>{t.citizen.cardRequestsTitle}</span>
                  <ChevronIcon className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.citizen.cardRequestsDesc}
                </p>
              </button>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-left rtl:text-right">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1">{t.citizen.cardCertifiedTitle}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.citizen.cardCertifiedDesc}
                </p>
              </div>
            </div>

            {/* Info panel */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                {t.citizen.howItWorksTitle}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: "1", title: t.citizen.step1Title, desc: t.citizen.step1Desc },
                  { step: "2", title: t.citizen.step2Title, desc: t.citizen.step2Desc },
                  { step: "3", title: t.citizen.step3Title, desc: t.citizen.step3Desc },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 font-mono">
                      {formatNumber(Number(item.step))}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200 mb-0.5">{item.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "forecast" && (
          <div className="space-y-6">
            {citizenForecast ? (
              <>
                <KpiCards kpis={citizenForecast.kpis} />
                <ForecastTab
                  timeseries={citizenForecast.timeseries}
                  displayUnit="kW"
                  ciLevel={90}
                  entityLabel={pvProfile?.governorate || "your area"}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-400">Loading forecast curve...</div>
            )}
          </div>
        )}

        {activeTab === "risk" && citizenForecast && (
          <CitizenRiskTab
            forecast={citizenForecast}
            displayUnit="kW"
            entityLabel={pvProfile?.governorate || "your area"}
            activeBattery={activeBattery}
            riskCoordinates={riskCoordinates}
          />
        )}

        {/* ============ BATTERY CATALOG ============ */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100">{t.citizen.catalogTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {t.citizen.catalogSubtitle}
              </p>
            </div>

            {/* AI Recommendation Card */}
            {loadingRecommendation ? (
              <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-slate-900 p-5 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <Bot className="w-4 h-4 text-indigo-400 absolute inset-0 m-auto" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-300">{t.citizen.aiAdvisorAnalyzing}</p>
                  <p className="text-[11px] text-slate-500">{t.citizen.aiAdvisorDesc}</p>
                </div>
              </div>
            ) : aiRecommendation?.has_recommendation && aiRecommendation.recommended_battery ? (
              <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 to-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                      <Bot className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                        {t.citizen.aiRecTitle}
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          <Sparkles className="w-2.5 h-2.5" />
                          {t.citizen.aiRecAgentTag}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">{t.citizen.aiRecSubtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-400">
                      {aiRecommendation.recommended_battery.brand} {aiRecommendation.recommended_battery.model}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatNumber(aiRecommendation.recommended_battery.usable_capacity_kwh, { maximumFractionDigits: 1 })} kWh ·{" "}
                      {aiRecommendation.recommended_battery.voltage_type === "HV" ? t.citizen.highVoltage : t.citizen.lowVoltage48v} ·{" "}
                      {t.adminRequests.autonomy} {formatNumber(aiRecommendation.recommended_battery.self_sufficiency_pct || 0, { maximumFractionDigits: 1 })}%
                    </p>

                    {aiRecommendation.reasoning && (
                      <ul className="mt-2 space-y-1">
                        {aiRecommendation.reasoning.map((r, i) => (
                          <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const bat = batteries.find((b) => b.id === aiRecommendation.recommended_battery!.battery_id);
                      if (bat) openApplianceModal(bat);
                    }}
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    {t.citizen.chooseThisBattery}
                  </button>
                </div>
              </div>
            ) : aiRecommendation && !aiRecommendation.has_recommendation ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3 text-xs text-amber-300">
                <Bot className="w-5 h-5 shrink-0" />
                <span>{aiRecommendation.message || t.citizen.noCompatibleBattery}</span>
              </div>
            ) : null}

            {loadingCatalog ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
            ) : batteries.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <Battery className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{t.citizen.noBatteriesInCatalog}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {t.citizen.noBatteriesApiHint}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batteries.map((bat) => (
                  <div
                    key={bat.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 p-5 transition-all group"
                  >
                    {/* Badge row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-slate-500">{bat.brand}</span>
                      {bat.steg_certified === 1 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                          <ShieldCheck className="w-3 h-3" /> {t.common.certified}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-slate-200 text-sm mb-3">{bat.model}</h3>

                    {/* Specs grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
                      <div>
                        <span className="text-slate-500">{t.citizen.specCapacity}</span>
                        <p className="text-slate-300 font-medium font-mono">
                          {formatNumber(bat.usable_capacity_kwh, { maximumFractionDigits: 1 })} kWh
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t.citizen.specChemistry}</span>
                        <p className="text-slate-300 font-medium">{bat.chemistry}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t.citizen.specVoltage}</span>
                        <p className="text-slate-300 font-medium">
                          {bat.voltage_type === "HV" ? t.citizen.highVoltage : t.citizen.lowVoltage48v}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t.citizen.specEfficiency}</span>
                        <p className="text-slate-300 font-medium font-mono">
                          {formatNumber(Math.round(bat.round_trip_eff * 100))}%
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t.citizen.specMaxCharge}</span>
                        <p className="text-slate-300 font-medium font-mono">
                          {formatNumber(bat.max_charge_kw, { maximumFractionDigits: 1 })} kW
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t.citizen.specMaxDischarge}</span>
                        <p className="text-slate-300 font-medium font-mono">
                          {formatNumber(bat.max_discharge_kw, { maximumFractionDigits: 1 })} kW
                        </p>
                      </div>
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={() => openApplianceModal(bat)}
                      disabled={submitting === bat.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      {t.citizen.requestBatteryButton}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ MY REQUESTS ============ */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{t.citizen.myRequestsTitle}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t.citizen.myRequestsSubtitle}
                </p>
              </div>
              <button
                onClick={loadRequests}
                className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {t.citizen.refreshBtn}
              </button>
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
            ) : myRequests.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{t.citizen.noRequestsYet}</p>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="mt-4 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  {t.citizen.browseCatalogBtn}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: status icon + info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5">{statusIcon(req.status)}</div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-200 truncate">
                            {req.battery_brand} {req.battery_model}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatNumber(req.usable_capacity_kwh, { maximumFractionDigits: 1 })} kWh · {t.citizen.requestNumber.replace("{id}", req.id)}
                          </p>
                        </div>
                      </div>

                      {/* Right: status badge + date */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(req.status)}`}>
                          {translateStatus(req.status)}
                        </span>
                        <span className="text-xs text-slate-600">
                          {formatDate(req.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Appliances list if present */}
                    {req.appliances && req.appliances.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60 mt-2">
                        <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                          <Tv className="w-3.5 h-3.5 text-teal-400" />
                          {t.citizen.plannedAppliances.replace("{count}", formatNumber(req.appliances.length))}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {req.appliances.map((app, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300"
                            >
                              <span className="font-medium text-emerald-400">{app.name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                ({formatNumber(app.consumption_w)}W{app.quantity && app.quantity > 1 ? ` × ${formatNumber(app.quantity)}` : ""}{app.hours_per_day ? ` · ${formatNumber(app.hours_per_day)}h/j` : ""})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Installation Tracking Stepper (When Approved) */}
                    {req.status === "APPROVED" && (
                      <div className="pt-3 border-t border-slate-800/80 mt-3 bg-slate-950/40 -mx-5 -mb-5 p-5 rounded-b-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                            <Wrench className="w-4 h-4 text-emerald-400" />
                            {t.citizen.trackingTitle}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {translateStage(req.tracking_stage || "APPROVED")}
                          </span>
                        </div>

                        {/* 5-Step Visual Stepper */}
                        {(() => {
                          const stages = [
                            { key: "APPROVED", label: t.adminRequests.stageApproved },
                            { key: "INSTALLATION_SCHEDULED", label: t.adminRequests.stageScheduled },
                            { key: "INSTALLING", label: t.adminRequests.stageInstalling },
                            { key: "COMMISSIONING", label: t.adminRequests.stageCommissioning },
                            { key: "ACTIVE", label: t.adminRequests.stageActive },
                          ];
                          const curStage = req.tracking_stage || "APPROVED";
                          const curIdx = stages.findIndex((s) => s.key === curStage);

                          return (
                            <div className="grid grid-cols-5 gap-2 pt-1">
                              {stages.map((st, sIdx) => {
                                const isPassed = sIdx <= curIdx;
                                const isCurrent = sIdx === curIdx;

                                return (
                                  <div key={st.key} className="flex flex-col items-center text-center">
                                    <div
                                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                        isCurrent
                                          ? "bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20"
                                          : isPassed
                                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                                          : "bg-slate-800/60 border border-slate-700 text-slate-600"
                                      }`}
                                    >
                                      {isPassed ? (
                                        <Check className="w-3.5 h-3.5" />
                                      ) : (
                                        <span>{formatNumber(sIdx + 1)}</span>
                                      )}
                                    </div>
                                    <span
                                      className={`text-[10px] mt-1 font-medium leading-tight ${
                                        isCurrent
                                          ? "text-emerald-300 font-semibold"
                                          : isPassed
                                          ? "text-slate-300"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {st.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Tracking metadata details (installer, date, meter) */}
                        {(req.installer_name || req.scheduled_date || req.commissioning_date || req.steg_meter_ref) && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            {req.installer_name && (
                              <div>
                                <span className="text-slate-500 block">{t.citizen.installerLabel}</span>
                                <span className="text-slate-200 font-medium">{req.installer_name}</span>
                              </div>
                            )}
                            {req.scheduled_date && (
                              <div>
                                <span className="text-slate-500 block">{t.citizen.scheduledDateLabel}</span>
                                <span className="text-slate-200 font-medium">{formatDate(req.scheduled_date)}</span>
                              </div>
                            )}
                            {req.steg_meter_ref && (
                              <div>
                                <span className="text-slate-500 block">{t.citizen.stegMeterLabel}</span>
                                <span className="text-emerald-400 font-mono">{req.steg_meter_ref}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============ APPLIANCE SPECIFICATION MODAL ============ */}
      {selectedBattery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0c1220] border border-slate-800 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {t.citizen.newRequestModalTitle}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                  {t.citizen.newRequestModalHeading
                    .replace("{brand}", selectedBattery.brand)
                    .replace("{model}", selectedBattery.model)}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t.citizen.newRequestModalDesc.replace(
                    "{capacity}",
                    formatNumber(selectedBattery.usable_capacity_kwh, { maximumFractionDigits: 1 })
                  )}
                </p>
              </div>
              <button
                onClick={closeApplianceModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="py-3 border-b border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-medium block mb-2">
                {t.citizen.quickPresetsTitle}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: t.citizen.presetFridge, w: 150, h: 24 },
                  { name: t.citizen.presetAC, w: 1200, h: 6 },
                  { name: t.citizen.presetTv, w: 100, h: 5 },
                  { name: t.citizen.presetLed, w: 60, h: 6 },
                  { name: t.citizen.presetWashing, w: 2000, h: 1.5 },
                  { name: t.citizen.presetRouter, w: 20, h: 24 },
                  { name: t.citizen.presetPump, w: 750, h: 2 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addPresetAppliance(item.name, item.w, item.h)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-emerald-500/20 hover:text-emerald-300 border border-slate-700/60 text-slate-300 transition-all cursor-pointer"
                  >
                    + {item.name} ({formatNumber(item.w)}W)
                  </button>
                ))}
              </div>
            </div>

            {/* Appliances Dynamic Form List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300">
                  {t.citizen.appliancesListTitle.replace("{count}", formatNumber(appliances.length))}
                </span>
                <button
                  type="button"
                  onClick={addApplianceRow}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.citizen.addApplianceBtn}
                </button>
              </div>

              {appliances.map((app, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {t.citizen.applianceItemLabel.replace("{num}", formatNumber(idx + 1))}
                    </label>
                    <input
                      type="text"
                      placeholder={t.citizen.applianceNamePlaceholder}
                      value={app.name}
                      onChange={(e) => updateApplianceRow(idx, "name", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-left rtl:text-right"
                    />
                  </div>

                  <div className="w-full sm:w-28">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {t.citizen.powerWattsLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="150"
                      value={app.consumption_w || ""}
                      onChange={(e) => updateApplianceRow(idx, "consumption_w", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-left rtl:text-right"
                    />
                  </div>

                  <div className="w-full sm:w-20">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {t.citizen.quantityLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={app.quantity || 1}
                      onChange={(e) => updateApplianceRow(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono text-left rtl:text-right"
                    />
                  </div>

                  <div className="w-full sm:w-24">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {t.citizen.hoursPerDayLabel}
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={app.hours_per_day || ""}
                      placeholder="h/jour"
                      onChange={(e) => updateApplianceRow(idx, "hours_per_day", parseFloat(e.target.value) || undefined)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono text-left rtl:text-right"
                    />
                  </div>

                  <div className="sm:self-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => removeApplianceRow(idx)}
                      disabled={appliances.length <= 1}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title={t.citizen.deleteRowTitle}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Total estimation */}
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {t.citizen.totalEstimatedConsumption}
                </span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {formatNumber(
                    appliances.reduce(
                      (acc, a) => acc + (a.consumption_w * (a.quantity || 1) * (a.hours_per_day || 1)) / 1000,
                      0
                    ),
                    { maximumFractionDigits: 2 }
                  )}{" "}
                  {t.citizen.kwhPerDay}
                </span>
              </div>
            </div>

            {/* Footer with action buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeApplianceModal}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.common.cancel}
              </button>

              <button
                type="button"
                onClick={handleConfirmApplication}
                disabled={submitting === selectedBattery.id}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting === selectedBattery.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {submitting === selectedBattery.id ? t.citizen.submittingApplicationBtn : t.citizen.submitApplicationBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 px-6">
        <p className="text-center text-[10px] text-slate-600">
          {t.citizen.footerCopyright}
        </p>
      </footer>
    </div>
  );
}
