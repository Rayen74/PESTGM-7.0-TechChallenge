import React from "react";
import { Info } from "lucide-react";

interface NormalizationBannerProps {
  capacityVal: number;
  capacityUnit: "kWp" | "MWp";
  displayUnit: "W" | "kW" | "MW";
}

export const NormalizationBanner: React.FC<NormalizationBannerProps> = ({
  capacityVal,
  capacityUnit,
  displayUnit,
}) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="text-sm text-slate-300 leading-relaxed">
          <span className="font-semibold text-amber-300">📐 Référence Normalisée (1 kWc) : </span>
          Les prédictions du modèle Deep Learning (<code className="text-amber-400 font-mono">keras_nn</code>) sont intrinsèquement normalisées à{" "}
          <strong className="text-white">1 kWc de puissance installée (W/kWc)</strong>, le parc photovoltaïque réel par région étant évolutif.
          <br className="hidden sm:inline" />
          <span className="text-slate-400">
            Dans cet affichage, les valeurs sont automatiquement multipliées par votre capacité configurée :{" "}
          </span>
          <span className="inline-flex items-center font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 mx-1">
            {capacityVal.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {capacityUnit}
          </span>
          <span className="text-slate-400">
            (Sortie affichée en <strong className="text-emerald-400">{displayUnit}</strong>).
          </span>
        </div>
      </div>
    </div>
  );
};
