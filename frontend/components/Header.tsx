"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";

export const Header: React.FC<{ isHealthy?: boolean; children?: React.ReactNode }> = ({
  isHealthy = true,
  children,
}) => {
  const { t } = useI18n();

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-40 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Title — takes available space */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-amber-400 leading-tight truncate">
            {t.header.title}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
            {t.header.subtitle}
          </p>
        </div>

        {/* Right side controls: status, custom actions (e.g. logout), language selector — all horizontal */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 whitespace-nowrap bg-slate-800/40 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="hidden md:inline">{isHealthy ? t.header.weatherHealthy : t.header.weatherNeedsAttention}</span>
            <span className="inline md:hidden">{isHealthy ? "OK" : "!"}</span>
          </div>

          {/* Children slot (e.g. Logout button) */}
          {children}

          {/* Language selector */}
          <LanguageSelector compact />
        </div>
      </div>
    </header>
  );
};

