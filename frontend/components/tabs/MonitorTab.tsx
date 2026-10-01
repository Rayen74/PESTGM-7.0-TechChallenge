"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { TelemetryResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface Props {
  telemetry: TelemetryResponse;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const MonitorTab: React.FC<Props> = ({ telemetry, onRefresh, isRefreshing }) => {
  const { t } = useI18n();
  const healthy = telemetry.status === "HEALTHY";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{t.monitor.title}</h2>
        <p className="mt-2 text-base text-slate-400">{t.monitor.subtitle}</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${healthy ? "bg-emerald-400" : "bg-red-400"}`} />
          <p className="text-lg text-white">
            {healthy ? t.monitor.statusHealthy : t.monitor.statusAttention}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? t.monitor.refreshing : t.monitor.refresh}
        </button>
      </div>
    </div>
  );
};
