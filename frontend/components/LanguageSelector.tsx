"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { SupportedLanguage } from "@/lib/i18n/translations";
import { Globe, Check, ChevronDown } from "lucide-react";

const languages: { code: SupportedLanguage; label: string; flag: string; nativeName: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷", nativeName: "Français (Défaut)" },
  { code: "ar", label: "العربية", flag: "🇹🇳", nativeName: "العربية (تونس)" },
  { code: "en", label: "English", flag: "🇬🇧", nativeName: "English" },
];

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, isRtl } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 transition-all cursor-pointer shadow-sm shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="text-sm leading-none">{currentLang.flag}</span>
        <span className="hidden sm:inline font-medium">{compact ? currentLang.code.toUpperCase() : currentLang.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute mt-2 w-44 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl py-1.5 z-50 ${
            isRtl ? "left-0" : "right-0"
          }`}
        >
          {languages.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left rtl:text-right ${
                  isSelected
                    ? "bg-amber-500/15 text-amber-300 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{l.flag}</span>
                  <div>
                    <span className="block font-medium">{l.label}</span>
                    <span className="block text-[10px] text-slate-500 font-normal">{l.nativeName}</span>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
