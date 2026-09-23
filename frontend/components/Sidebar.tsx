import React from "react";
import { Sliders, RefreshCw, Layers, Calendar, Cpu, ShieldCheck } from "lucide-react";
import { DISTRICTS, GOVERNORATES } from "@/lib/constants";

interface SidebarProps {
  scaleType: "National (Agrégé)" | "District (Régional)" | "Gouvernorat (Local)";
  setScaleType: (val: "National (Agrégé)" | "District (Régional)" | "Gouvernorat (Local)") => void;
  selectedDistrict: string;
  setSelectedDistrict: (val: string) => void;
  selectedGov: string;
  setSelectedGov: (val: string) => void;
  horizonChoice: "Intra-journalier (Aujourd'hui / 24h)" | "D à D+3 (Dispatch opérationnel / 96h)" | "Horizon Étendu (Jusqu'à D+16)";
  setHorizonChoice: (val: "Intra-journalier (Aujourd'hui / 24h)" | "D à D+3 (Dispatch opérationnel / 96h)" | "Horizon Étendu (Jusqu'à D+16)") => void;
  capVal: number;
  setCapVal: (val: number) => void;
  capUnit: "kWp" | "MWp";
  setCapUnit: (val: "kWp" | "MWp") => void;
  ciLevel: number;
  setCiLevel: (val: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  scaleType,
  setScaleType,
  selectedDistrict,
  setSelectedDistrict,
  selectedGov,
  setSelectedGov,
  horizonChoice,
  setHorizonChoice,
  capVal,
  setCapVal,
  capUnit,
  setCapUnit,
  ciLevel,
  setCiLevel,
  onRefresh,
  isRefreshing,
}) => {
  const govList = Object.keys(GOVERNORATES);

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-6">
      <div className="glass-panel p-5 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sliders className="w-5 h-5 text-amber-400" />
          <h2 className="font-bold text-slate-100 text-base">Paramètres du Système</h2>
        </div>

        {/* Active Model Indicator */}
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>Modèle Actif :</span>
            <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              keras_nn ⚡
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Deep Neural Network (Validation RMSE: 0.759 W — Top Performer)
          </p>
        </div>

        {/* 1. Spatial Scale */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            1. Échelle Spatiale
          </label>
          <div className="space-y-1.5">
            {(["National (Agrégé)", "District (Régional)", "Gouvernorat (Local)"] as const).map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  scaleType === type
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                }`}
              >
                <input
                  type="radio"
                  name="scaleType"
                  value={type}
                  checked={scaleType === type}
                  onChange={() => setScaleType(type)}
                  className="accent-amber-500"
                />
                {type}
              </label>
            ))}
          </div>

          {/* Sub-selector for District */}
          {scaleType === "District (Régional)" && (
            <div className="pt-2">
              <label className="text-xs text-slate-400 mb-1 block">Choisir le District :</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sub-selector for Governorate */}
          {scaleType === "Gouvernorat (Local)" && (
            <div className="pt-2">
              <label className="text-xs text-slate-400 mb-1 block">Choisir le Gouvernorat :</label>
              <select
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {govList.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 2. Temporal Horizon */}
        <div className="space-y-3 border-t border-slate-800/80 pt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            2. Horizon Temporel
          </label>
          <div className="space-y-1.5">
            {(
              [
                "Intra-journalier (Aujourd'hui / 24h)",
                "D à D+3 (Dispatch opérationnel / 96h)",
                "Horizon Étendu (Jusqu'à D+16)",
              ] as const
            ).map((h) => (
              <label
                key={h}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  horizonChoice === h
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
                }`}
              >
                <input
                  type="radio"
                  name="horizonChoice"
                  value={h}
                  checked={horizonChoice === h}
                  onChange={() => setHorizonChoice(h)}
                  className="accent-amber-500"
                />
                {h}
              </label>
            ))}
          </div>
        </div>

        {/* 3. Installed Capacity Multiplier */}
        <div className="space-y-3 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              3. Puissance Installée
            </label>
            <span className="text-[11px] font-mono text-amber-400 font-semibold">
              {capVal} {capUnit}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Ajustez la capacité pour simuler une centrale ou une zone :
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={capVal}
                onChange={(e) => setCapVal(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <select
                value={capUnit}
                onChange={(e) => setCapUnit(e.target.value as "kWp" | "MWp")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-semibold"
              >
                <option value="kWp">kWp</option>
                <option value="MWp">MWp</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Confidence Interval */}
        <div className="space-y-3 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              4. Intervalle de Confiance
            </label>
            <span className="text-xs font-mono font-bold text-amber-400">{ciLevel}%</span>
          </div>
          <input
            type="range"
            min="80"
            max="98"
            step="1"
            value={ciLevel}
            onChange={(e) => setCiLevel(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>80%</span>
            <span>90% (Standard)</span>
            <span>98%</span>
          </div>
        </div>

        {/* 5. Live Refresh Button */}
        <div className="border-t border-slate-800/80 pt-4">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
              isRefreshing
                ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 shadow-amber-500/10 cursor-pointer active:scale-[0.98]"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
            {isRefreshing ? "Actualisation en cours..." : "🔄 Rafraîchir les données météo"}
          </button>
        </div>
      </div>
    </aside>
  );
};
