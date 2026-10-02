"use client";

import React, { useState } from "react";
import { RiskAssessment } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { ShieldAlert, X } from "lucide-react";

export function RiskCard({ risk, unit, citizen = false }: { risk: RiskAssessment; unit: string; citizen?: boolean }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const style = risk.risk_level === "LOW"
    ? { border: "border-emerald-500/40", text: "text-emerald-400", label: t.risk.low }
    : risk.risk_level === "MEDIUM"
    ? { border: "border-amber-500/40", text: "text-amber-400", label: t.risk.medium }
    : { border: "border-red-500/40", text: "text-red-400", label: t.risk.high };
  const localizedReason = language === "ar"
    ? risk.risk_level === "LOW" ? "\u0627\u0644\u0646\u0637\u0627\u0642 \u0636\u064a\u0642 \u0648\u0627\u0644\u062a\u0648\u0642\u0639 \u0645\u0633\u062a\u0642\u0631." : risk.risk_level === "MEDIUM" ? "\u0627\u0644\u0646\u0637\u0627\u0642 \u0623\u0648 \u0627\u0644\u0637\u0642\u0633 \u064a\u0632\u064a\u062f \u0639\u062f\u0645 \u0627\u0644\u064a\u0642\u064a\u0646." : "\u0627\u0644\u0646\u0637\u0627\u0642 \u0648\u0627\u0633\u0639 \u0623\u0648 \u0627\u0644\u0637\u0642\u0633 \u0645\u062a\u063a\u064a\u0631."
    : language === "fr"
    ? risk.risk_level === "LOW" ? "Intervalle etroit et prevision stable." : risk.risk_level === "MEDIUM" ? "L intervalle ou la meteo ajoutent de l incertitude." : "Intervalle large ou meteo tres variable."
    : risk.risk_level === "LOW" ? "The interval is narrow and the forecast is stable." : risk.risk_level === "MEDIUM" ? "The interval or weather conditions add uncertainty." : "The interval is wide or weather conditions are highly variable.";
  const advice = language === "ar"
    ? { reserve: "\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637.", charge: "\u0627\u0634\u062d\u0646 \u0639\u0646\u062f \u062a\u0648\u0641\u0631 \u0627\u0644\u0625\u0646\u062a\u0627\u062c.", discharge: "\u0627\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0645\u062e\u0632\u0646\u0629 \u0628\u062d\u0630\u0631." }
    : language === "fr"
    ? { reserve: "Gardez une reserve.", charge: "Chargez quand la production est disponible.", discharge: "Utilisez l energie stockee avec prudence." }
    : { reserve: "Keep battery reserve.", charge: "Charge when production is available.", discharge: "Use stored energy carefully." };
  return (
    <>
    <button type="button" onClick={() => setOpen(true)} aria-label={t.risk.open} title={t.risk.open} className={`rounded-xl border ${style.border} bg-slate-900/80 p-3 ${style.text} hover:bg-slate-800 transition-colors`}>
      <ShieldAlert className="h-5 w-5" />
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} className={`w-full max-w-2xl rounded-2xl border ${style.border} bg-[#0c1220] p-6 space-y-4 shadow-2xl`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{citizen ? t.risk.citizenTitle : t.risk.title}</h3>
          <p className="text-xs text-slate-500 mt-1">{t.risk.provisional}</p>
        </div>
        <div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1 text-sm font-semibold ${style.text} ${style.border}`}>{style.label}</span><button type="button" onClick={() => setOpen(false)} aria-label={t.risk.close}><X className="h-5 w-5 text-slate-400" /></button></div>
      </div>
      <p className="text-sm text-slate-200">{localizedReason}</p>
      {!citizen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div><span className="block text-slate-500">{t.risk.conservative}</span><strong className="text-white">{risk.conservative_value.toFixed(1)} {unit}</strong></div>
          <div><span className="block text-slate-500">{t.risk.shortfall}</span><strong className="text-white">{risk.possible_shortfall.toFixed(1)} {unit}</strong></div>
          <div><span className="block text-slate-500">{t.risk.gridReserve}</span><strong className="text-white">{risk.recommended_grid_reserve_pct}%</strong></div>
        </div>
      )}
      {risk.weather.available ? (
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-lg bg-slate-800 px-2 py-1">{t.risk.clouds} {risk.weather.cloud_cover_pct ?? 0}%</span>
          <span className="rounded-lg bg-slate-800 px-2 py-1">{t.risk.rain} {risk.weather.rain_mm ?? 0} mm</span>
          <span className="rounded-lg bg-slate-800 px-2 py-1">{t.risk.wind} {risk.weather.wind_mps ?? 0} m/s</span>
        </div>
      ) : !citizen ? <p className="text-xs text-slate-500">{t.risk.weatherUnavailable}</p> : null}
      {!citizen && <p className="text-sm text-slate-300">{language === "fr" ? "Planifiez selon la recommandation de dispatch et conservez la r?serve." : language === "ar" ? "??? ??? ????? ??????? ????? ??? ?????????." : "Plan according to the dispatch recommendation and preserve reserve."}</p>}
      {!citizen && risk.human_review_required && <p className="text-sm font-semibold text-red-300">{t.risk.review}</p>}
      {citizen && (
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><span className="block text-slate-500">{t.risk.reserve}</span><span className="text-slate-200">{advice.reserve}</span></div>
          <div><span className="block text-slate-500">{t.risk.charging}</span><span className="text-slate-200">{advice.charge}</span></div>
          <div><span className="block text-slate-500">{t.risk.discharging}</span><span className="text-slate-200">{advice.discharge}</span></div>
        </div>
      )}
      </section></div>}
    </>
  );
}
