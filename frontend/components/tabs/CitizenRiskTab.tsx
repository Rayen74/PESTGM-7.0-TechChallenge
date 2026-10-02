"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { ForecastResponse } from "@/lib/types";
import { ForecastTab } from "./ForecastTab";
import { useI18n } from "@/lib/i18n";

export function CitizenRiskTab({ forecast, displayUnit, entityLabel, activeBattery, riskCoordinates }: {
  forecast: ForecastResponse;
  displayUnit: string;
  entityLabel: string;
  activeBattery: boolean;
  riskCoordinates?: { latitude?: number; longitude?: number };
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 text-emerald-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">{t.risk.citizenTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {activeBattery ? t.risk.citizenIntro : t.risk.noActive}
            </p>
          </div>
        </div>
      </div>
      <ForecastTab
        timeseries={forecast.timeseries}
        displayUnit={displayUnit}
        ciLevel={90}
        entityLabel={entityLabel}
        showRisk={activeBattery}
        citizen={activeBattery}
        riskCoordinates={riskCoordinates}
      />
    </div>
  );
}
