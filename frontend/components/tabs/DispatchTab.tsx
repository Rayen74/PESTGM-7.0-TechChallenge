"use client";

import React, { useState } from "react";
import { Download, Table, FileSpreadsheet, FileCode, Search } from "lucide-react";
import { DispatchRecord } from "@/lib/types";

interface DispatchTabProps {
  records: DispatchRecord[];
  displayUnit: string;
  onDownloadCsv: () => void;
  onDownloadJson: () => void;
}

export const DispatchTab: React.FC<DispatchTabProps> = ({
  records,
  displayUnit,
  onDownloadCsv,
  onDownloadJson,
}) => {
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
      <div className="glass-panel p-5 space-y-2">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Table className="w-5 h-5 text-amber-400" />
          ⚡ Outils d&apos;Échange avec le Dispatching National de la STEG
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Cette interface génère des flux de données standardisés pour transmission aux systèmes de gestion de réseau
          (<strong>EMS / SCADA</strong>) de la STEG, intégrant la puissance attendue, les bandes d&apos;incertitude et
          l&apos;indice de certitude opérationnel.
        </p>

        {/* Download Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button
            onClick={onDownloadCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-all text-xs font-bold cursor-pointer active:scale-95 shadow-lg shadow-emerald-950/20"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            📥 Télécharger CSV Dispatch (STEG)
          </button>

          <button
            onClick={onDownloadJson}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600/20 text-sky-300 border border-sky-500/40 hover:bg-sky-600/30 transition-all text-xs font-bold cursor-pointer active:scale-95 shadow-lg shadow-sky-950/20"
          >
            <FileCode className="w-4 h-4 text-sky-400" />
            📥 Télécharger JSON Dispatch (SCADA)
          </button>
        </div>
      </div>

      {/* Dispatch Data Grid */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">Tableau Prévisionnel de Dispatch</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {filtered.length} créneaux horaires
            </span>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par date ou entité..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Date/Heure (UTC)</th>
                <th className="py-2.5 px-3">Niveau</th>
                <th className="py-2.5 px-3">Entité</th>
                <th className="py-2.5 px-3 text-right">Prévision P ({displayUnit})</th>
                <th className="py-2.5 px-3 text-right">Borne Inf.</th>
                <th className="py-2.5 px-3 text-right">Borne Sup.</th>
                <th className="py-2.5 px-3 text-right">Certitude %</th>
                <th className="py-2.5 px-3 text-right">G(i) (W/m²)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {currentRecords.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-slate-300 font-sans">
                    {new Date(row.time).toISOString().replace("T", " ").substring(0, 16)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans capitalize">{row.scale_level}</td>
                  <td className="py-2.5 px-3 text-amber-300 font-sans font-semibold">{row.entity_name}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{row.power_forecast.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{row.power_lower_bound.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{row.power_upper_bound.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-sky-400">{row.certitude_pct.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right text-orange-400">{Math.round(row.gi)}</td>
                </tr>
              ))}
              {currentRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    Aucune prévision ne correspond à votre recherche.
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
              Page {currentPage} sur {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
              >
                Précédent
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
