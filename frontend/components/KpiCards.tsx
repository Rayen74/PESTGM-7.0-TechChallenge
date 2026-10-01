"use client";

import React from "react";
import { KPIData } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export const KpiCards: React.FC<{ kpis: KPIData }> = ({ kpis }) => {
  const { t, formatNumber } = useI18n();

  const cards = [
    [
      t.kpi.expectedPeak,
      `${formatNumber(kpis.peak_power, { maximumFractionDigits: 1 })} ${kpis.display_unit}`,
      t.kpi.expectedPeakDesc,
    ],
    [
      t.kpi.energyProducedToday,
      `${formatNumber(kpis.total_energy, { maximumFractionDigits: 1 })} ${kpis.energy_unit}`,
      t.kpi.energyProducedTodayDesc,
    ],
    [
      t.kpi.typicalCertainty,
      `${formatNumber(Math.round(kpis.avg_certitude))}%`,
      t.kpi.typicalCertaintyDesc,
    ],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {cards.map(([label, value, note]) => (
        <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-bold text-white font-mono">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{note}</p>
        </div>
      ))}
    </div>
  );
};
