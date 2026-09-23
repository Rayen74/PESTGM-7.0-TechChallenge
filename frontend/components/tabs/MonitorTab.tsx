import React from "react";
import { Activity, Clock, CheckCircle2, ShieldCheck, Terminal, AlertTriangle } from "lucide-react";
import { TelemetryResponse } from "@/lib/types";

interface MonitorTabProps {
  telemetry: TelemetryResponse;
}

export const MonitorTab: React.FC<MonitorTabProps> = ({ telemetry }) => {
  const isHealthy = telemetry.status === "HEALTHY";
  const isWarning = telemetry.status === "WARNING" || telemetry.status === "DEGRADED";

  const statusColor = isHealthy ? "text-emerald-400" : isWarning ? "text-amber-400" : "text-red-400";
  const statusBg = isHealthy
    ? "bg-emerald-500/10 border-emerald-500/30"
    : isWarning
    ? "bg-amber-500/10 border-amber-500/30"
    : "bg-red-500/10 border-red-500/30";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="glass-panel p-5">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          🛰️ Surveillance en Continu & Diagnostics de l&apos;API Météo
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Contrôle automatique de l&apos;ingestion météorologique (Open-Meteo) et intégrité des signaux physiques.
        </p>
      </div>

      {/* 4 Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="glass-panel p-4 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>État du Flux Météo</span>
            <span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          </div>
          <div>
            <div className={`text-2xl font-black ${statusColor}`}>{telemetry.status}</div>
            <div className="text-xs text-slate-400 mt-1">Open-Meteo Forecast API</div>
          </div>
        </div>

        {/* Latency */}
        <div className="glass-panel p-4 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>Temps de Réponse API</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white flex items-baseline gap-1">
              <span>{Math.round(telemetry.latency_ms)}</span>
              <span className="text-sky-400 text-sm font-semibold">ms</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">Latence réseau mesurée</div>
          </div>
        </div>

        {/* Schema Verification */}
        <div className="glass-panel p-4 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>Variables Vérifiées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">
              {telemetry.variables_verified ? "13 / 13" : "Incomplet"}
            </div>
            <div className="text-xs text-slate-400 mt-1">Conformité du schéma</div>
          </div>
        </div>

        {/* Physical Bounds */}
        <div className="glass-panel p-4 flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>Limites Physiques</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">
              {telemetry.physical_bounds_passed ? "Validées" : "Alerte"}
            </div>
            <div className="text-xs text-slate-400 mt-1">GHI, T2m, Pression, RH</div>
          </div>
        </div>
      </div>

      {/* Operator Maintenance Guide Card */}
      <div className="glass-panel p-6 space-y-4">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Terminal className="w-4 h-4 text-amber-400" />
          Guide Opérateur : Surveillance & Maintenance
        </h4>

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <h5 className="font-bold text-amber-300">1. Automatisation en continu (Tâche planifiée) :</h5>
            <p className="text-slate-400">
              Le script <code className="text-amber-400 font-mono">python -m src.weather_monitor --force</code> peut être programmé
              pour s&apos;exécuter toutes les 3 heures (sous Windows Task Scheduler ou cron Linux). Dès qu&apos;un nouveau cycle de modèle météorologique
              (ECMWF/GFS) est disponible, il met à jour automatiquement <code className="text-slate-300 font-mono">data/processed/latest_forecast.csv</code>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <h5 className="font-bold text-amber-300">2. Contrôle et Supervision :</h5>
            <p className="text-slate-400">
              L&apos;API Open-Meteo est vérifiée à chaque cycle pour s&apos;assurer de l&apos;absence de valeurs aberrantes
              (irradiance négative, températures hors normes). En cas de défaillance réseau, le système conserve la dernière prévision valide sans interrompre la plateforme.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <h5 className="font-bold text-amber-300">3. Modèle en Production :</h5>
            <p className="text-slate-400">
              <strong className="text-white">Keras NN</strong> est configuré comme le moteur exclusif. Les modèles Random Forest sont bloqués par sécurité d&apos;intégrité logicielle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
