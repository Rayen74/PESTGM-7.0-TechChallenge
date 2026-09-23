"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TimeSeriesItem } from "@/lib/types";

interface ForecastTabProps {
  timeseries: TimeSeriesItem[];
  displayUnit: string;
  ciLevel: number;
  entityLabel: string;
}

export const ForecastTab: React.FC<ForecastTabProps> = ({
  timeseries,
  displayUnit,
  ciLevel,
  entityLabel,
}) => {
  // Format times for display: "DD/MM HH:mm"
  const formattedData = timeseries.map((item) => {
    const d = new Date(item.time);
    const timeFormatted = `${d.getUTCDate().toString().padStart(2, "0")}/${(d.getUTCMonth() + 1)
      .toString()
      .padStart(2, "0")} ${d.getUTCHours().toString().padStart(2, "0")}:00`;

    // To create shaded band in Recharts:
    // base = power_lower_bound
    // diff = power_upper_bound - power_lower_bound (stacked on top)
    const lower = Math.max(0, item.power_lower_bound);
    const upper = Math.max(lower, item.power_upper_bound);
    const bandSpan = Math.max(0, upper - lower);

    return {
      ...item,
      timeFormatted,
      lower,
      bandSpan,
    };
  });

  return (
    <div className="space-y-6">
      {/* Main Load Curve Chart */}
      <div className="glass-panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Courbe de Charge Prédictive avec Intervalle de Confiance ({entityLabel})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production photovoltaïque attendue (P) et fuseau de couverture opérationnel à {ciLevel}%.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400 inline-block rounded"></span>
              Prévision Attendue (P)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-amber-500/25 inline-block rounded border border-amber-500/50"></span>
              Intervalle ({ciLevel}%)
            </span>
          </div>
        </div>

        <div className="h-[440px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="timeFormatted"
                stroke="#64748b"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                angle={-30}
                textAnchor="end"
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                label={{
                  value: `Puissance Électrique (${displayUnit})`,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as typeof formattedData[0];
                    return (
                      <div className="glass-panel p-3 shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[200px]">
                        <p className="font-bold text-slate-200 border-b border-slate-700/80 pb-1">
                          📅 {data.timeFormatted} (UTC)
                        </p>
                        <p className="text-amber-300 font-semibold flex justify-between">
                          <span>Prévision P :</span>
                          <span>
                            {data.power_forecast.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {displayUnit}
                          </span>
                        </p>
                        <p className="text-slate-400 flex justify-between">
                          <span>Intervalle :</span>
                          <span className="font-mono text-slate-300">
                            [{data.power_lower_bound.toFixed(2)}, {data.power_upper_bound.toFixed(2)}] {displayUnit}
                          </span>
                        </p>
                        <p className="text-sky-300 flex justify-between">
                          <span>Certitude :</span>
                          <span>{data.certitude_pct.toFixed(1)}%</span>
                        </p>
                        <p className="text-orange-300 flex justify-between">
                          <span>Irradiance G(i) :</span>
                          <span>{Math.round(data.gi)} W/m²</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Invisible lower base for stacking */}
              <Area type="monotone" dataKey="lower" stackId="ci" stroke="none" fill="transparent" />
              {/* Shaded confidence interval band */}
              <Area
                type="monotone"
                dataKey="bandSpan"
                stackId="ci"
                stroke="none"
                fill="url(#bandGradient)"
                name={`Intervalle (${ciLevel}%)`}
              />
              {/* Point Forecast Line */}
              <Line
                type="monotone"
                dataKey="power_forecast"
                stroke="#f59e0b"
                strokeWidth={2.8}
                dot={{ r: 2, fill: "#f59e0b" }}
                activeDot={{ r: 5, fill: "#fef3c7" }}
                name="Prévision (P)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Uncertainty Analysis & Diurnal Profiles (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Certitude % Bar Chart */}
        <div className="glass-panel p-5">
          <div className="pb-3 border-b border-slate-800">
            <h4 className="text-sm font-bold text-slate-200">Indice de Certitude Opérationnel (%)</h4>
            <p className="text-[11px] text-slate-400">Degré de fiabilité météorologique heure par heure.</p>
          </div>
          <div className="h-[260px] w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="timeFormatted"
                  stroke="#64748b"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  angle={-30}
                  textAnchor="end"
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  domain={[50, 100]}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  label={{ value: "%", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as typeof formattedData[0];
                      return (
                        <div className="glass-panel p-2 text-xs border border-slate-700 shadow-md">
                          <p className="text-slate-300 font-semibold">{d.timeFormatted}</p>
                          <p className="text-emerald-400 font-bold">Certitude : {d.certitude_pct.toFixed(1)}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="certitude_pct" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Column 2: Plane of Array Irradiance G(i) */}
        <div className="glass-panel p-5">
          <div className="pb-3 border-b border-slate-800">
            <h4 className="text-sm font-bold text-slate-200">Irradiance Globale Inclinée G(i) (W/m²)</h4>
            <p className="text-[11px] text-slate-400">Irradiance effective transposée sur plan 30° Sud.</p>
          </div>
          <div className="h-[260px] w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <defs>
                  <linearGradient id="giGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="timeFormatted"
                  stroke="#64748b"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  angle={-30}
                  textAnchor="end"
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as typeof formattedData[0];
                      return (
                        <div className="glass-panel p-2 text-xs border border-slate-700 shadow-md">
                          <p className="text-slate-300 font-semibold">{d.timeFormatted}</p>
                          <p className="text-sky-300 font-bold">G(i) : {Math.round(d.gi)} W/m²</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="gi" stroke="#38bdf8" strokeWidth={2} fill="url(#giGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
