"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { GovernorateSummary, DistrictSummary } from "@/lib/types";
import { MapPin, Layers, SunMedium, ShieldCheck, Zap } from "lucide-react";

// Dynamically import Leaflet map with SSR turned off because Leaflet requires window
const LeafletMap = dynamic(
  () => import("./LeafletMap").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[620px] rounded-xl bg-slate-950 flex flex-col items-center justify-center border border-slate-800 text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs">Chargement de la carte cartographique de Tunisie...</p>
      </div>
    ),
  }
);

interface MapTabProps {
  governorates: GovernorateSummary[];
  districts: DistrictSummary[];
  displayUnit: string;
}

export const MapTab: React.FC<MapTabProps> = ({
  governorates,
  districts,
  displayUnit,
}) => {
  const [selectedGov, setSelectedGov] = useState<GovernorateSummary | null>(null);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            Carte Géographique Complète & Répartition Solaire en Tunisie
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Carte géographique plein écran (Carto Darkmatter) avec les 24 gouvernorats géolocalisés et synthèse régionale STEG.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-semibold">Intensité :</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span>
            <span className="text-[11px] text-slate-400">Modérée</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            <span className="text-[11px] text-slate-400">Élevée</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span className="text-[11px] text-slate-400">Maximale</span>
          </div>
        </div>
      </div>

      {/* Main Map + District Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Full Geographic Leaflet Map */}
        <div className="lg:col-span-8 glass-panel p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Vue Cartographique Interactive ({displayUnit})
            </span>
            <span className="text-[11px] text-slate-500">
              Zoomez, déplacez la carte ou cliquez sur un gouvernorat
            </span>
          </div>

          <LeafletMap
            governorates={governorates}
            displayUnit={displayUnit}
            onSelectGov={setSelectedGov}
          />
        </div>

        {/* Right Column: Active Governorate Card + Regional District Bar Chart */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Selected Governorate Detail Card */}
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs uppercase font-bold text-slate-400">Gouvernorat Sélectionné</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {selectedGov ? selectedGov.district : "Survoler la carte"}
              </span>
            </div>

            {selectedGov ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{selectedGov.governorate}</span>
                  <span className="text-xs font-mono text-slate-400">
                    {selectedGov.latitude.toFixed(2)}°N, {selectedGov.longitude.toFixed(2)}°E
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Puissance Crête</span>
                    <span className="text-base font-extrabold text-amber-400 font-mono">
                      {selectedGov.peak_power.toFixed(2)} {displayUnit}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Irradiance Max G(i)</span>
                    <span className="text-base font-extrabold text-sky-400 font-mono">
                      {Math.round(selectedGov.peak_gi)} W/m²
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Indice de Certitude</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {selectedGov.avg_cert.toFixed(1)}%
                      </span>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Pointez ou cliquez sur l&apos;un des 24 gouvernorats sur la carte pour afficher ses indicateurs solaires détaillés.
              </div>
            )}
          </div>

          {/* District Comparative Ranking */}
          <div className="glass-panel p-5 flex-1 flex flex-col justify-between">
            <div className="pb-3 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Comparatif des 7 Districts ({displayUnit})
              </h4>
              <p className="text-[11px] text-slate-500">Somme de la puissance de crête par district STEG.</p>
            </div>

            <div className="h-[360px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={districts}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis
                    type="category"
                    dataKey="district"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: "#cbd5e1" }}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as DistrictSummary;
                        return (
                          <div className="glass-panel p-2 text-xs border border-slate-700 shadow-md">
                            <p className="text-amber-300 font-bold">{d.district}</p>
                            <p className="text-slate-200 mt-1">
                              Puissance Totale :{" "}
                              <span className="font-bold text-emerald-400">
                                {d.peak_power.toFixed(2)} {displayUnit}
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="peak_power" radius={[0, 4, 4, 0]}>
                    {districts.map((entry, index) => {
                      const colors = ["#f59e0b", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#0284c7", "#0369a1"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
