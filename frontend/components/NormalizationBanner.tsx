"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

interface Props {
  capacityVal: number;
  capacityUnit: "kWp" | "MWp";
  displayUnit: "W" | "kW" | "MW";
}

export const NormalizationBanner: React.FC<Props> = ({ capacityVal, capacityUnit }) => {
  const { t, formatNumber } = useI18n();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">
      {t.kpi.solarForecastCapacity}{" "}
      <span className="font-semibold text-white font-mono">
        {formatNumber(capacityVal, { maximumFractionDigits: 1 })} {capacityUnit === "kWp" ? "kW" : "MW"}
      </span>{" "}
      {t.kpi.ofCapacity}
    </div>
  );
};
