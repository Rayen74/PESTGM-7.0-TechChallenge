"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { ForecastResponse } from "@/lib/types";
import { ForecastTab } from "./ForecastTab";
import { useI18n } from "@/lib/i18n";

export function RiskOperationsTab({
  forecast,
  displayUnit,
  ciLevel,
  entityLabel,
  riskCoordinates,
}: {
  forecast: ForecastResponse;
  displayUnit: string;
  ciLevel: number;
  entityLabel: string;
  riskCoordinates?: { latitude?: number; longitude?: number };
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 text-amber-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">{t.risk.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              {t.risk.provisional}
            </p>
          </div>
        </div>
      </div>
      <ForecastTab
        timeseries={forecast.timeseries}
        displayUnit={displayUnit}
        ciLevel={ciLevel}
        entityLabel={entityLabel}
        showRisk
        riskCoordinates={riskCoordinates}
      />
    </div>
  );
}
