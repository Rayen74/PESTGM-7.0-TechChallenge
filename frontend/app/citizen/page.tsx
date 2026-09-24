"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBatteryCatalog,
  fetchMyRequests,
  submitBatteryRequest,
  fetchPVProfile,
  savePVProfile,
} from "@/lib/api";
import { BatteryItem, BatteryRequestItem, ApplianceItem } from "@/lib/types";
import {
  Sun,
  LogOut,
  Battery,
  ClipboardList,
  Home,
  Loader2,
  Send,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  ChevronRight,
  BatteryCharging,
  ShieldCheck,
  Plus,
  Trash2,
  Tv,
  Check,
  X,
  Wrench,
  Calendar,
} from "lucide-react";



type CitizenTab = "home" | "catalog" | "requests";

export default function CitizenDashboard() {
  const router = useRouter();
  const [sess, setSess] = useState<{ email: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<CitizenTab>("home");

  // ---------- Data ----------
  const [batteries, setBatteries] = useState<BatteryItem[]>([]);
  const [myRequests, setMyRequests] = useState<BatteryRequestItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  // ---------- Auth ----------
  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "CITIZEN") {
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
          setProfileReady(true);
        } catch {
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
    } catch {
      setMyRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "catalog") loadCatalog();
    if (activeTab === "requests") loadRequests();
  }, [activeTab, loadCatalog, loadRequests]);

  // ---------- Appliance Modal State ----------
  const [selectedBattery, setSelectedBattery] = useState<BatteryItem | null>(null);
  const [appliances, setAppliances] = useState<ApplianceItem[]>([
    { name: "Réfrigérateur", consumption_w: 150, quantity: 1, hours_per_day: 24 }
  ]);


  const openApplianceModal = (battery: BatteryItem) => {
    setSelectedBattery(battery);
    setAppliances([
      { name: "Réfrigérateur", consumption_w: 150, quantity: 1, hours_per_day: 24 }
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

  // Quick preset appliance adder
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
        } catch { /* proceed anyway */ }
      }
      
      // Clean appliances
      const validAppliances = appliances
        .filter((a) => a.name.trim() !== "" && a.consumption_w > 0)
        .map((a) => ({
          name: a.name.trim(),
          consumption_w: Number(a.consumption_w),
          quantity: Math.max(1, Number(a.quantity || 1)),
          hours_per_day: a.hours_per_day ? Number(a.hours_per_day) : undefined,
        }));

      await submitBatteryRequest(bId, validAppliances);
      setToast("Demande soumise avec succès avec vos appareils !");
      setTimeout(() => setToast(null), 3500);
      closeApplianceModal();
      setActiveTab("requests");
      loadRequests();
    } catch (err: any) {
      setToast(err.message || "Erreur lors de la soumission");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(null);
    }
  };


  // ---------- Helpers ----------
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

  const statusLabel = (s: string) => {
    switch (s) {
      case "SUBMITTED": return "En attente";
      case "UNDER_REVIEW": return "En cours d'examen";
      case "INFO_REQUESTED": return "Info demandée";
      case "APPROVED": return "Approuvée";
      case "REJECTED": return "Rejetée";
      default: return s;
    }
  };

  const TABS: { key: CitizenTab; icon: React.ElementType; label: string }[] = [
    { key: "home", icon: Home, label: "Accueil" },
    { key: "catalog", icon: Battery, label: "Catalogue Batteries" },
    { key: "requests", icon: ClipboardList, label: "Mes Demandes" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      {/* ---- Header ---- */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sun className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
                Espace Citoyen
              </h1>
              <p className="text-[10px] text-slate-500">STEG Solar — Gestion Batterie</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:block">{sess?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl animate-bounce">
          {toast}
        </div>
      )}

      {/* ---- Navigation ---- */}
      <nav className="border-b border-slate-800/60 bg-slate-900/30">
        <div className="max-w-6xl mx-auto flex gap-1 px-6 overflow-x-auto">
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
      <main className="max-w-6xl w-full mx-auto p-6 flex-1">
        {/* ============ HOME ============ */}
        {activeTab === "home" && (
          <div className="space-y-8">
            {/* Welcome banner */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-slate-100 mb-2">
                  Bienvenue, {sess?.email?.split("@")[0] || "Citoyen"} 👋
                </h2>
                <p className="text-sm text-slate-400 max-w-lg">
                  Gérez votre installation solaire et soumettez vos demandes de batterie.
                  L&apos;administrateur STEG examinera chaque demande et vous notifiera du résultat.
                </p>
              </div>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab("catalog")}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 p-6 text-left transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <BatteryCharging className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
                  Catalogue Batteries
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </h3>
                <p className="text-xs text-slate-500">
                  Parcourez les batteries certifiées STEG disponibles en Tunisie
                </p>
              </button>

              <button
                onClick={() => setActiveTab("requests")}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 p-6 text-left transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
                  Mes Demandes
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                </h3>
                <p className="text-xs text-slate-500">
                  Suivez l&apos;état de vos demandes d&apos;installation de batterie
                </p>
              </button>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1">Certifié STEG</h3>
                <p className="text-xs text-slate-500">
                  Toutes les batteries du catalogue sont conformes aux normes STEG Tunisie
                </p>
              </div>
            </div>

            {/* Info panel */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Comment ça marche ?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: "1", title: "Choisir une batterie", desc: "Consultez le catalogue et sélectionnez la batterie adaptée à votre installation" },
                  { step: "2", title: "Soumettre la demande", desc: "Cliquez sur « Demander » pour soumettre votre demande à l'administrateur STEG" },
                  { step: "3", title: "Suivi & Installation", desc: "Suivez l'état de votre demande et préparez l'installation après approbation" },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                      {item.step}
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

        {/* ============ BATTERY CATALOG ============ */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Catalogue des Batteries</h2>
              <p className="text-xs text-slate-500 mt-1">
                Sélectionnez une batterie certifiée STEG et soumettez votre demande d&apos;installation
              </p>
            </div>

            {loadingCatalog ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
            ) : batteries.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <Battery className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Aucune batterie disponible pour le moment</p>
                <p className="text-xs text-slate-600 mt-1">
                  Le serveur API doit être lancé pour charger le catalogue.
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
                          <ShieldCheck className="w-3 h-3" /> Certifié
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-slate-200 text-sm mb-3">{bat.model}</h3>

                    {/* Specs grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
                      <div>
                        <span className="text-slate-500">Capacité</span>
                        <p className="text-slate-300 font-medium">{bat.usable_capacity_kwh} kWh</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Chimie</span>
                        <p className="text-slate-300 font-medium">{bat.chemistry}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tension</span>
                        <p className="text-slate-300 font-medium">{bat.voltage_type === "HV" ? "Haute Tension" : "48V"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Efficacité</span>
                        <p className="text-slate-300 font-medium">{Math.round(bat.round_trip_eff * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Charge max</span>
                        <p className="text-slate-300 font-medium">{bat.max_charge_kw} kW</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Décharge max</span>
                        <p className="text-slate-300 font-medium">{bat.max_discharge_kw} kW</p>
                      </div>
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={() => openApplianceModal(bat)}
                      disabled={submitting === bat.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      Demander cette batterie
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
                <h2 className="text-lg font-bold text-slate-100">Mes Demandes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Historique et état de vos demandes d&apos;installation de batterie
                </p>
              </div>
              <button
                onClick={loadRequests}
                className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Actualiser
              </button>
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              </div>
            ) : myRequests.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Vous n&apos;avez pas encore soumis de demande</p>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="mt-4 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  Voir le catalogue
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
                            {req.usable_capacity_kwh} kWh · Demande #{req.id}
                          </p>
                        </div>
                      </div>

                      {/* Right: status badge + date */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(req.status)}`}>
                          {statusLabel(req.status)}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(req.created_at).toLocaleDateString("fr-TN")}
                        </span>
                      </div>
                    </div>

                    {/* Appliances list if present */}
                    {req.appliances && req.appliances.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60 mt-2">
                        <p className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                          <Tv className="w-3.5 h-3.5 text-teal-400" />
                          Appareils prévus ({req.appliances.length}) :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {req.appliances.map((app, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300"
                            >
                              <span className="font-medium text-emerald-400">{app.name}</span>
                              <span className="text-[11px] text-slate-500">
                                ({app.consumption_w}W{app.quantity && app.quantity > 1 ? ` × ${app.quantity}` : ""}{app.hours_per_day ? ` · ${app.hours_per_day}h/j` : ""})
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
                            Suivi d&apos;installation STEG
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {req.tracking_stage || "APPROVED"}
                          </span>
                        </div>

                        {/* 5-Step Visual Stepper */}
                        {(() => {
                          const stages = [
                            { key: "APPROVED", label: "Approuvé" },
                            { key: "INSTALLATION_SCHEDULED", label: "Planifié" },
                            { key: "INSTALLING", label: "Installation" },
                            { key: "COMMISSIONING", label: "Mise en service" },
                            { key: "ACTIVE", label: "Raccordé Actif" },
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
                                        <span>{sIdx + 1}</span>
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
                                <span className="text-slate-500 block">Installateur :</span>
                                <span className="text-slate-200 font-medium">{req.installer_name}</span>
                              </div>
                            )}
                            {req.scheduled_date && (
                              <div>
                                <span className="text-slate-500 block">Date prévue :</span>
                                <span className="text-slate-200 font-medium">{req.scheduled_date}</span>
                              </div>
                            )}
                            {req.steg_meter_ref && (
                              <div>
                                <span className="text-slate-500 block">Compteur STEG :</span>
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
                  Nouvelle Demande
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                  Spécifier les appareils pour {selectedBattery.brand} {selectedBattery.model}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Indiquez les appareils électriques à alimenter avec cette batterie ({selectedBattery.usable_capacity_kwh} kWh).
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
                Ajout rapide d&apos;appareils courants :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "Réfrigérateur", w: 150, h: 24 },
                  { name: "Climatiseur 12000 BTU", w: 1200, h: 6 },
                  { name: "Téléviseur LED", w: 100, h: 5 },
                  { name: "Éclairage LED", w: 60, h: 6 },
                  { name: "Machine à laver", w: 2000, h: 1.5 },
                  { name: "Routeur Wi-Fi", w: 20, h: 24 },
                  { name: "Pompe à eau", w: 750, h: 2 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addPresetAppliance(item.name, item.w, item.h)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-emerald-500/20 hover:text-emerald-300 border border-slate-700/60 text-slate-300 transition-all cursor-pointer"
                  >
                    + {item.name} ({item.w}W)
                  </button>
                ))}
              </div>
            </div>

            {/* Appliances Dynamic Form List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300">
                  Liste des appareils ({appliances.length}) :
                </span>
                <button
                  type="button"
                  onClick={addApplianceRow}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter un appareil
                </button>
              </div>

              {appliances.map((app, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  {/* Name */}
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Appareil {idx + 1}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Réfrigérateur, Climatiseur..."
                      value={app.name}
                      onChange={(e) => updateApplianceRow(idx, "name", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Consommation */}
                  <div className="w-full sm:w-28">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Puissance (Watts)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="150"
                      value={app.consumption_w || ""}
                      onChange={(e) => updateApplianceRow(idx, "consumption_w", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Quantité */}
                  <div className="w-full sm:w-20">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={app.quantity || 1}
                      onChange={(e) => updateApplianceRow(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Heures par jour */}
                  <div className="w-full sm:w-24">
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Heures / jour
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={app.hours_per_day || ""}
                      placeholder="h/jour"
                      onChange={(e) => updateApplianceRow(idx, "hours_per_day", parseFloat(e.target.value) || undefined)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Remove row button */}
                  <div className="sm:self-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => removeApplianceRow(idx)}
                      disabled={appliances.length <= 1}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Total estimation */}
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Consommation totale estimée :
                </span>
                <span className="font-semibold text-emerald-400">
                  {appliances
                    .reduce((acc, a) => acc + (a.consumption_w * (a.quantity || 1) * (a.hours_per_day || 1)) / 1000, 0)
                    .toFixed(2)}{" "}
                  kWh / jour
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
                Annuler
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
                {submitting === selectedBattery.id ? "Soumission en cours…" : "Confirmer et Soumettre la Demande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 px-6">
        <p className="text-center text-[10px] text-slate-600">
          © 2026 STEG Solar Platform — Espace Citoyen
        </p>
      </footer>
    </div>
  );
}

