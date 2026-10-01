"use client";

import React, { useState } from "react";
import { Table, FileSpreadsheet, FileCode, Search } from "lucide-react";
import { DispatchRecord } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface DispatchTabProps {
  records: DispatchRecord[];
  displayUnit: string;
  onDownloadCsv?: () => void;
  onDownloadJson: () => void;
}

export const DispatchTab: React.FC<DispatchTabProps> = ({
  records,
  displayUnit,
  onDownloadCsv,
  onDownloadJson,
}) => {
  const { t, formatNumber, formatDateTime, isRtl, translateGovernorate, translateDistrict } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const filtered = records.filter(
    (r) =>
      r.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.time.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentRecords = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="glass-panel p-5 space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Table className="w-5 h-5 text-amber-400" />
            {t.dispatch.title}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-4xl mt-1">
            {t.dispatch.description}
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {onDownloadCsv && (
            <button
              onClick={onDownloadCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all text-xs font-bold cursor-pointer active:scale-95 shadow-lg shadow-amber-950/20"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              {t.dispatch.downloadCsv}
            </button>
          )}

          <button
            onClick={onDownloadJson}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600/20 text-sky-300 border border-sky-500/40 hover:bg-sky-600/30 transition-all text-xs font-bold cursor-pointer active:scale-95 shadow-lg shadow-sky-950/20"
          >
            <FileCode className="w-4 h-4 text-sky-400" />
            {t.dispatch.downloadJson}
          </button>
        </div>
      </div>

      {/* Dispatch Data Grid */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">{t.dispatch.scheduleTitle}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {t.dispatch.timeSlots.replace("{count}", formatNumber(filtered.length))}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className={`w-3.5 h-3.5 text-slate-500 absolute top-2.5 ${isRtl ? "right-3" : "left-3"}`} />
            <input
              type="text"
              placeholder={t.dispatch.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 ${
                isRtl ? "pr-8 pl-3" : "pl-8 pr-3"
              }`}
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className={`py-2.5 px-3 ${isRtl ? "text-right" : "text-left"}`}>{t.dispatch.thTime}</th>
                <th className={`py-2.5 px-3 ${isRtl ? "text-right" : "text-left"}`}>{t.dispatch.thRegion}</th>
                <th className={`py-2.5 px-3 ${isRtl ? "text-left" : "text-right"}`}>
                  {t.dispatch.thExpected.replace("{unit}", displayUnit)}
                </th>
                <th className={`py-2.5 px-3 ${isRtl ? "text-left" : "text-right"}`}>{t.dispatch.thLower}</th>
                <th className={`py-2.5 px-3 ${isRtl ? "text-left" : "text-right"}`}>{t.dispatch.thUpper}</th>
                <th className={`py-2.5 px-3 ${isRtl ? "text-left" : "text-right"}`}>{t.dispatch.thCertainty}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {currentRecords.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className={`py-2.5 px-3 text-slate-300 font-sans ${isRtl ? "text-right" : "text-left"}`}>
                    {row.time.replace("T", " ").substring(0, 16)}
                  </td>
                  <td className={`py-2.5 px-3 text-amber-300 font-sans font-semibold ${isRtl ? "text-right" : "text-left"}`}>
                    {translateGovernorate(translateDistrict(row.entity_name))}
                  </td>
                  <td className={`py-2.5 px-3 text-emerald-400 font-bold ${isRtl ? "text-left" : "text-right"}`}>
                    {formatNumber(row.power_forecast, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-3 text-slate-400 ${isRtl ? "text-left" : "text-right"}`}>
                    {formatNumber(row.power_lower_bound, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-3 text-slate-400 ${isRtl ? "text-left" : "text-right"}`}>
                    {formatNumber(row.power_upper_bound, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-3 text-sky-400 ${isRtl ? "text-left" : "text-right"}`}>
                    {formatNumber(row.certitude_pct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </td>
                </tr>
              ))}
              {currentRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    {t.dispatch.noMatch}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>
              {t.common.pageOf
                .replace("{current}", formatNumber(currentPage))
                .replace("{total}", formatNumber(totalPages))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
              >
                {t.common.previous}
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
              >
                {t.common.next}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
