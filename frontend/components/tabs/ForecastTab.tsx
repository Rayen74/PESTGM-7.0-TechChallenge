"use client";

import React, { useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TimeSeriesItem } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface ForecastTabProps {
  timeseries: TimeSeriesItem[];
  displayUnit: string;
  ciLevel: number;
  entityLabel: string;
}

export const ForecastTab: React.FC<ForecastTabProps> = ({ timeseries, displayUnit, ciLevel, entityLabel }) => {
  const { t, formatNumber, formatDate, formatDateTime, isRtl, translateDistrict, translateGovernorate } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const formatTime = (value: string) => {
    const date = new Date(value);
    const day = date.getUTCDate().toString().padStart(2, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const hour = date.getUTCHours().toString().padStart(2, "0");
    return `${day}/${month} ${hour}:00`;
  };

  const selected = timeseries[Math.min(selectedIndex, Math.max(timeseries.length - 1, 0))];
  const selectedTime = selected ? formatTime(selected.time) : "";
  const lower = selected ? Math.max(0, selected.power_lower_bound) : 0;
  const expected = selected ? Math.max(lower, selected.power_forecast) : 0;
  const upper = selected ? Math.max(expected, selected.power_upper_bound) : 0;
  const span = Math.max(upper - lower, 1);
  const marker = Math.min(100, Math.max(0, ((expected - lower) / span) * 100));
  const certainty = selected?.certitude_pct ?? 0;

  const certaintyStyles =
    certainty > 80
      ? { card: "border-emerald-500/40", value: "text-emerald-400", fill: "bg-emerald-400/40", marker: "bg-emerald-300" }
      : certainty >= 50
      ? { card: "border-amber-500/40", value: "text-amber-400", fill: "bg-amber-400/40", marker: "bg-amber-300" }
      : { card: "border-red-500/40", value: "text-red-400", fill: "bg-red-400/40", marker: "bg-red-300" };

  const certaintyWord =
    certainty > 80
      ? t.forecast.veryLikely
      : certainty >= 50
      ? t.forecast.likely
      : t.forecast.lessCertain;

  const localizedEntity = translateGovernorate(translateDistrict(entityLabel));

  const chartData = useMemo(
    () =>
      timeseries.map((item) => ({
        ...item,
        timeFormatted: formatTime(item.time),
        lower: Math.max(0, item.power_lower_bound),
        bandSpan: Math.max(0, item.power_upper_bound - item.power_lower_bound),
      })),
    [timeseries]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{t.forecast.title}</h2>
        <p className="mt-2 text-base text-slate-400">
          {t.forecast.subtitle.replace("{entity}", localizedEntity)}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">{t.forecast.chartTitle}</h3>
            <p className="text-sm text-slate-400 mt-1">{t.forecast.chartSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="forecast-hour" className="text-sm text-slate-400">
              {t.forecast.chooseTime}
            </label>
            <select
              id="forecast-hour"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              {timeseries.map((item, index) => (
                <option key={`${item.time}-${index}`} value={index}>
                  {formatTime(item.time)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-[390px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 25 }}>
              <defs>
                <linearGradient id="forecastRange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.06} />
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
              <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: "#94a3b8" }} unit={` ${displayUnit}`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as (typeof chartData)[number];
                  return (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm shadow-xl space-y-1">
                      <p className="font-semibold text-white mb-2">{item.timeFormatted}</p>
                      <p className="text-amber-300">
                        {t.forecast.expectedTooltip
                          .replace("{val}", formatNumber(item.power_forecast, { maximumFractionDigits: 1 }))
                          .replace("{unit}", displayUnit)}
                      </p>
                      <p className="text-slate-300">
                        {t.forecast.likelyRangeTooltip
                          .replace("{lower}", formatNumber(item.power_lower_bound, { maximumFractionDigits: 1 }))
                          .replace("{upper}", formatNumber(item.power_upper_bound, { maximumFractionDigits: 1 }))
                          .replace("{unit}", displayUnit)}
                      </p>
                      <p className="text-slate-400">
                        {t.forecast.certaintyTooltip.replace("{val}", formatNumber(Math.round(item.certitude_pct)))}
                      </p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="lower" stackId="range" stroke="none" fill="transparent" />
              <Area type="monotone" dataKey="bandSpan" stackId="range" stroke="none" fill="url(#forecastRange)" />
              <Line
                type="monotone"
                dataKey="power_forecast"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 2, fill: "#f59e0b" }}
                activeDot={{ r: 5, fill: "#fef3c7" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {selected && (
        <div className={`rounded-2xl border ${certaintyStyles.card} bg-slate-900/80 p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{t.forecast.howSureWeAre}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {t.forecast.forTimeInEntity.replace("{time}", selectedTime).replace("{entity}", localizedEntity)}
              </p>
            </div>
            <div className={`text-4xl font-bold font-mono ${certaintyStyles.value}`}>
              {formatNumber(Math.round(certainty))}%
            </div>
          </div>

          <div className="mt-7 px-1">
            <div className="relative h-3 rounded-full bg-slate-700">
              <div
                className={`absolute inset-y-0 ${isRtl ? "right-0" : "left-0"} rounded-full ${certaintyStyles.fill}`}
                style={{ width: `${Math.max(marker, 12)}%` }}
              />
              <span
                className={`absolute top-1/2 h-6 w-1 -translate-y-1/2 rounded-full ${certaintyStyles.marker}`}
                style={isRtl ? { right: `calc(${marker}% - 2px)` } : { left: `calc(${marker}% - 2px)` }}
              />
            </div>
            <div className="relative mt-3 flex justify-between text-sm">
              <span>
                <span className="block text-slate-500">{t.forecast.lower}</span>
                <span className="font-semibold text-white font-mono">
                  {formatNumber(lower, { maximumFractionDigits: 1 })} {displayUnit}
                </span>
              </span>
              <span className="text-center">
                <span className="block text-slate-500">{t.forecast.expected}</span>
                <span className="font-semibold text-white font-mono">
                  {formatNumber(expected, { maximumFractionDigits: 1 })} {displayUnit}
                </span>
              </span>
              <span className={isRtl ? "text-left" : "text-right"}>
                <span className="block text-slate-500">{t.forecast.upper}</span>
                <span className="font-semibold text-white font-mono">
                  {formatNumber(upper, { maximumFractionDigits: 1 })} {displayUnit}
                </span>
              </span>
            </div>
          </div>

          <p className="mt-6 text-base text-slate-200">
            {t.forecast.certaintySentence
              .replace("{word}", certaintyWord)
              .replace("{lower}", formatNumber(lower, { maximumFractionDigits: 1 }))
              .replace("{upper}", formatNumber(upper, { maximumFractionDigits: 1 }))
              .replace("{unit}", displayUnit)
              .replace("{pct}", formatNumber(Math.round(certainty)))}
          </p>
        </div>
      )}

      <details className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-300">{t.forecast.aboutTitle}</summary>
        <p className="mt-3 leading-relaxed">
          {t.forecast.aboutDesc.replace("{ciLevel}", formatNumber(ciLevel))}
        </p>
      </details>
    </div>
  );
};
