"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GovernorateSummary } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface LeafletMapProps {
  governorates: GovernorateSummary[];
  displayUnit: string;
  onSelectGov: (gov: GovernorateSummary) => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  governorates,
  displayUnit,
  onSelectGov,
}) => {
  const { t, formatNumber, isRtl, translateDistrict, translateGovernorate } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [34.5, 9.6],
        zoom: 6.8,
        minZoom: 5,
        maxZoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ["a", "b", "c"],
        maxZoom: 19,
        className: "map-tiles-dark",
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    const markersLayer = markersLayerRef.current;
    if (markersLayer) {
      markersLayer.clearLayers();

      const maxPeak = Math.max(...governorates.map((g) => g.peak_power), 1);
      const minPeak = Math.min(...governorates.map((g) => g.peak_power), 0);

      governorates.forEach((gov) => {
        const range = maxPeak - minPeak || 1;
        const normalized = (gov.peak_power - minPeak) / range;
        const radius = 3 + normalized * 5;

        const color =
          normalized > 0.8
            ? "#ef4444"
            : normalized > 0.6
            ? "#f97316"
            : normalized > 0.4
            ? "#f59e0b"
            : normalized > 0.2
            ? "#eab308"
            : "#06b6d4";

        const circleMarker = L.circleMarker([gov.latitude, gov.longitude], {
          radius: radius,
          fillColor: color,
          color: "#ffffff",
          weight: 1.5,
          opacity: 0.95,
          fillOpacity: 0.85,
        });

        const localizedGovName = translateGovernorate(gov.governorate);
        const localizedDistName = translateDistrict(gov.district);
        const dir = isRtl ? "rtl" : "ltr";
        const align = isRtl ? "right" : "left";

        const popupContent = `
          <div dir="${dir}" style="font-family: -apple-system, BlinkMacSystemFont, 'Cairo', sans-serif; min-width: 175px; color: #0f172a; padding: 3px; text-align: ${align};">
            <div style="font-weight: 700; font-size: 13px; color: #0f172a; border-bottom: 2px solid #f59e0b; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span>${localizedGovName}</span>
              <span style="font-size: 10px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #475569; font-weight: 600;">${localizedDistName}</span>
            </div>
            <div style="font-size: 12px; margin-bottom: 3px;">
              <span style="color: #64748b;">${t.map.popupPeak}</span> 
              <span style="color: #ea580c; font-weight: 700; font-family: monospace;">${formatNumber(gov.peak_power, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${displayUnit}</span>
            </div>
            <div style="font-size: 12px; margin-bottom: 3px;">
              <span style="color: #64748b;">${t.map.popupIrradiance}</span> 
              <span style="color: #0284c7; font-weight: 600;">${formatNumber(Math.round(gov.peak_gi))} W/m²</span>
            </div>
            <div style="font-size: 12px;">
              <span style="color: #64748b;">${t.map.popupCertainty}</span> 
              <span style="color: #10b981; font-weight: 700;">${formatNumber(gov.avg_cert, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
            </div>
          </div>
        `;

        circleMarker.bindPopup(popupContent, {
          closeButton: false,
          offset: [0, -4],
        });

        circleMarker.on("mouseover", function () {
          this.openPopup();
          onSelectGov(gov);
        });

        circleMarker.on("click", function () {
          onSelectGov(gov);
        });

        markersLayer.addLayer(circleMarker);
      });

      if (mapInstanceRef.current) {
        const bounds = L.latLngBounds(
          governorates.map((g) => [g.latitude, g.longitude] as [number, number])
        );
        mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [governorates, displayUnit, onSelectGov, t, formatNumber, isRtl, translateDistrict, translateGovernorate]);

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
};
