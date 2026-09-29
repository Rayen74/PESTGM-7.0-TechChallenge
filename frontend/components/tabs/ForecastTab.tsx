"use client";

import React, { useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TimeSeriesItem } from "@/lib/types";

interface ForecastTabProps { timeseries: TimeSeriesItem[]; displayUnit: string; ciLevel: number; entityLabel: string; }

const formatTime = (value: string) => {
  const date = new Date(value);
  return `${date.getUTCDate().toString().padStart(2, "0")}/${(date.getUTCMonth() + 1).toString().padStart(2, "0")} ${date.getUTCHours().toString().padStart(2, "0")}:00`;
};

export const ForecastTab: React.FC<ForecastTabProps> = ({ timeseries, displayUnit, ciLevel, entityLabel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = timeseries[Math.min(selectedIndex, Math.max(timeseries.length - 1, 0))];
  const selectedTime = selected ? formatTime(selected.time) : "";
  const lower = selected ? Math.max(0, selected.power_lower_bound) : 0;
  const expected = selected ? Math.max(lower, selected.power_forecast) : 0;
  const upper = selected ? Math.max(expected, selected.power_upper_bound) : 0;
  const span = Math.max(upper - lower, 1);
  const marker = Math.min(100, Math.max(0, ((expected - lower) / span) * 100));
  const certainty = selected?.certitude_pct ?? 0;
  const certaintyColor = certainty > 80 ? "emerald" : certainty >= 50 ? "amber" : "red";
  const certaintyStyles = certainty > 80 ? { card: "border-emerald-500/40", value: "text-emerald-400", fill: "bg-emerald-400/40", marker: "bg-emerald-300" } : certainty >= 50 ? { card: "border-amber-500/40", value: "text-amber-400", fill: "bg-amber-400/40", marker: "bg-amber-300" } : { card: "border-red-500/40", value: "text-red-400", fill: "bg-red-400/40", marker: "bg-red-300" };
  const certaintyWord = certainty > 80 ? "Very likely" : certainty >= 50 ? "Likely" : "Less certain";

  const chartData = useMemo(() => timeseries.map((item) => ({
    ...item,
    timeFormatted: formatTime(item.time),
    lower: Math.max(0, item.power_lower_bound),
    bandSpan: Math.max(0, item.power_upper_bound - item.power_lower_bound),
  })), [timeseries]);

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-white">Your solar forecast</h2><p className="mt-2 text-base text-slate-400">See expected production and the range it is most likely to fall within for {entityLabel}.</p></div>

    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div><h3 className="text-lg font-semibold text-white">Expected production over time</h3><p className="text-sm text-slate-400 mt-1">The shaded area shows the likely range.</p></div>
        <div className="flex items-center gap-2"><label htmlFor="forecast-hour" className="text-sm text-slate-400">Choose a time</label><select id="forecast-hour" value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">{timeseries.map((item, index) => <option key={`${item.time}-${index}`} value={index}>{formatTime(item.time)}</option>)}</select></div>
      </div>
      <div className="h-[390px] w-full">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 25 }}>
          <defs><linearGradient id="forecastRange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.06} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="timeFormatted" stroke="#64748b" tick={{ fontSize: 11, fill: "#94a3b8" }} angle={-30} textAnchor="end" interval="preserveStartEnd" />
          <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: "#94a3b8" }} unit={` ${displayUnit}`} />
          <Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const item = payload[0].payload as typeof chartData[number]; return <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm shadow-xl"><p className="font-semibold text-white mb-2">{item.timeFormatted}</p><p className="text-amber-300">Expected: {item.power_forecast.toFixed(1)} {displayUnit}</p><p className="text-slate-300">Likely range: {item.power_lower_bound.toFixed(1)}?{item.power_upper_bound.toFixed(1)} {displayUnit}</p><p className="text-slate-400">Certainty: {item.certitude_pct.toFixed(0)}%</p></div>; }} />
          <Area type="monotone" dataKey="lower" stackId="range" stroke="none" fill="transparent" /><Area type="monotone" dataKey="bandSpan" stackId="range" stroke="none" fill="url(#forecastRange)" />
          <Line type="monotone" dataKey="power_forecast" stroke="#f59e0b" strokeWidth={3} dot={{ r: 2, fill: "#f59e0b" }} activeDot={{ r: 5, fill: "#fef3c7" }} />
        </ComposedChart></ResponsiveContainer>
      </div>
    </div>

    {selected && <div className={`rounded-2xl border ${certaintyStyles.card} bg-slate-900/80 p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div><h3 className="text-lg font-semibold text-white">How sure we are</h3><p className="mt-1 text-sm text-slate-400">For {selectedTime}, in {entityLabel}.</p></div><div className={`text-4xl font-bold ${certaintyStyles.value}`}>{certainty.toFixed(0)}%</div></div>
      <div className="mt-7 px-1"><div className="relative h-3 rounded-full bg-slate-700"><div className={`absolute inset-y-0 left-0 rounded-full ${certaintyStyles.fill}`} style={{ width: `${Math.max(marker, 12)}%` }} /><span className={`absolute top-1/2 h-6 w-1 -translate-y-1/2 rounded-full ${certaintyStyles.marker}`} style={{ left: `calc(${marker}% - 2px)` }} /></div><div className="relative mt-3 flex justify-between text-sm"><span><span className="block text-slate-500">Lower</span><span className="font-semibold text-white">{lower.toFixed(1)} {displayUnit}</span></span><span className="text-center"><span className="block text-slate-500">Expected</span><span className="font-semibold text-white">{expected.toFixed(1)} {displayUnit}</span></span><span className="text-right"><span className="block text-slate-500">Upper</span><span className="font-semibold text-white">{upper.toFixed(1)} {displayUnit}</span></span></div></div>
      <p className="mt-6 text-base text-slate-200">{certaintyWord} between {lower.toFixed(1)} and {upper.toFixed(1)} {displayUnit}. We are {certainty.toFixed(0)}% sure.</p>
    </div>}

    <details className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400"><summary className="cursor-pointer font-medium text-slate-300">About this forecast</summary><p className="mt-3 leading-relaxed">The expected value is calculated from recent weather patterns and historical production. The lower and upper values show the selected forecast range at {ciLevel}% coverage.</p></details>
  </div>;
};
