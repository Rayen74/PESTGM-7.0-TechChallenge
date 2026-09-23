import React from "react";
import { Zap, BatteryCharging, ShieldAlert, SunMedium } from "lucide-react";
import { KPIData } from "@/lib/types";

interface KpiCardsProps {
  kpis: KPIData;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Peak Power */}
      <div className="glass-panel p-4 relative overflow-hidden transition-all duration-200 hover:border-amber-500/40">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Puissance Crête Prévue</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white">
            {kpis.peak_power.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-amber-400 font-bold text-sm">{kpis.display_unit}</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Pic attendu sur l&apos;horizon
        </div>
      </div>

      {/* 2. Total Energy */}
      <div className="glass-panel p-4 relative overflow-hidden transition-all duration-200 hover:border-emerald-500/40">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Énergie Totale Attendue</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <BatteryCharging className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white">
            {kpis.total_energy.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-emerald-400 font-bold text-sm">{kpis.energy_unit}</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Production cumulée injectée
        </div>
      </div>

      {/* 3. Average Certainty */}
      <div className="glass-panel p-4 relative overflow-hidden transition-all duration-200 hover:border-sky-500/40">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Indice de Certitude Moyen</span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white">
            {kpis.avg_certitude.toFixed(1)}
          </span>
          <span className="text-sky-400 font-bold text-sm">%</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          Fiabilité opérationnelle jour
        </div>
      </div>

      {/* 4. Peak Irradiance G(i) */}
      <div className="glass-panel p-4 relative overflow-hidden transition-all duration-200 hover:border-orange-500/40">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <span>Irradiance Max G(i)</span>
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
            <SunMedium className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white">
            {Math.round(kpis.peak_gi).toLocaleString("fr-FR")}
          </span>
          <span className="text-orange-400 font-bold text-sm">W/m²</span>
        </div>
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400"></span>
          Plan incliné 30° Sud
        </div>
      </div>
    </div>
  );
};
