"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SupportedLanguage, TranslationDictionary } from "./translations";
import { fr } from "./fr";
import { ar } from "./ar";
import { en } from "./en";

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  fr,
  ar,
  en,
};

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationDictionary;
  isRtl: boolean;
  formatNumber: (val: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (val: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (val: number, currency?: string) => string;
  formatDateTime: (val: string | Date) => string;
  translateScale: (scale: string) => string;
  translateHorizon: (horizon: string) => string;
  translateStatus: (status: string) => string;
  translateStage: (stage: string) => string;
  translateDistrict: (district: string) => string;
  translateGovernorate: (gov: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "steg_solar_lang";

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>("fr");

  // Read initial saved language from localStorage on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && (saved === "fr" || saved === "ar" || saved === "en")) {
        setLanguageState(saved);
        applyLanguageToDocument(saved);
      } else {
        applyLanguageToDocument("fr");
      }
    } catch {
      applyLanguageToDocument("fr");
    }
  }, []);

  const applyLanguageToDocument = (lang: SupportedLanguage) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      if (lang === "ar") {
        document.documentElement.classList.add("rtl");
      } else {
        document.documentElement.classList.remove("rtl");
      }
    }
  };

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    applyLanguageToDocument(lang);
  }, []);

  const isRtl = language === "ar";
  const t = dictionaries[language] || dictionaries.fr;

  const getLocaleString = useCallback(() => {
    if (language === "ar") return "ar-TN";
    if (language === "fr") return "fr-TN";
    return "en-US";
  }, [language]);

  const formatNumber = useCallback(
    (val: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(getLocaleString(), options).format(val);
    },
    [getLocaleString]
  );

  const formatDate = useCallback(
    (val: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof val === "string" ? new Date(val) : val;
      const opts: Intl.DateTimeFormatOptions = options || {
        year: "numeric",
        month: "short",
        day: "numeric",
      };
      return new Intl.DateTimeFormat(getLocaleString(), opts).format(d);
    },
    [getLocaleString]
  );

  const formatDateTime = useCallback(
    (val: string | Date) => {
      const d = typeof val === "string" ? new Date(val) : val;
      return new Intl.DateTimeFormat(getLocaleString(), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    },
    [getLocaleString]
  );

  const formatCurrency = useCallback(
    (val: number, currency: string = "TND") => {
      if (language === "ar") {
        return `${new Intl.NumberFormat("ar-TN", { maximumFractionDigits: 2 }).format(val)} د.ت`;
      }
      if (language === "fr") {
        return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 2 }).format(val)} DT`;
      }
      return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(val)} TND`;
    },
    [language]
  );

  // Helper mappings for system dropdowns & scales
  const translateScale = useCallback(
    (scale: string) => {
      if (scale.includes("National")) return t.sidebar.scaleNational;
      if (scale.includes("District")) return t.sidebar.scaleDistrict;
      if (scale.includes("Gouvernorat")) return t.sidebar.scaleGovernorate;
      return scale;
    },
    [t]
  );

  const translateHorizon = useCallback(
    (horizon: string) => {
      if (horizon.includes("Intra") || horizon.includes("24h")) return t.sidebar.horizonIntraDay;
      if (horizon.includes("D à D+3") || horizon.includes("96h") || horizon.includes("D to D+3")) return t.sidebar.horizonD3;
      if (horizon.includes("Étendu") || horizon.includes("Extended") || horizon.includes("D+16")) return t.sidebar.horizonExtended;
      return horizon;
    },
    [t]
  );

  const translateStatus = useCallback(
    (status: string) => {
      switch (status) {
        case "SUBMITTED":
          return t.adminRequests.statusSubmitted;
        case "UNDER_REVIEW":
          return t.adminRequests.statusUnderReview;
        case "INFO_REQUESTED":
          return t.adminRequests.statusInfoRequested;
        case "APPROVED":
          return t.adminRequests.statusApproved;
        case "REJECTED":
          return t.adminRequests.statusRejected;
        default:
          return status;
      }
    },
    [t]
  );

  const translateStage = useCallback(
    (stage: string) => {
      switch (stage) {
        case "APPROVED":
          return t.adminRequests.stageApproved;
        case "INSTALLATION_SCHEDULED":
          return t.adminRequests.stageScheduled;
        case "INSTALLING":
          return t.adminRequests.stageInstalling;
        case "COMMISSIONING":
          return t.adminRequests.stageCommissioning;
        case "ACTIVE":
          return t.adminRequests.stageActive;
        default:
          return stage;
      }
    },
    [t]
  );

  const translateDistrict = useCallback(
    (district: string) => {
      if (language === "ar") {
        const arDistricts: Record<string, string> = {
          "Grand Tunis": "تونس الكبرى",
          "Nord-Est": "الشمال الشرقي",
          "Nord-Ouest": "الشمال الغربي",
          "Centre-Est": "الوسط الشرقي",
          "Centre-Ouest": "الوسط الغربي",
          "Sud-Est": "الجنوب الشرقي",
          "Sud-Ouest": "الجنوب الغربي",
        };
        return arDistricts[district] || district;
      }
      if (language === "en") {
        const enDistricts: Record<string, string> = {
          "Grand Tunis": "Greater Tunis",
          "Nord-Est": "North-East",
          "Nord-Ouest": "North-West",
          "Centre-Est": "Central-East",
          "Centre-Ouest": "Central-West",
          "Sud-Est": "South-East",
          "Sud-Ouest": "South-West",
        };
        return enDistricts[district] || district;
      }
      return district;
    },
    [language]
  );

  const translateGovernorate = useCallback(
    (gov: string) => {
      if (language === "ar") {
        const arGovs: Record<string, string> = {
          Tunis: "تونس",
          Ariana: "أريانة",
          "Ben Arous": "بن عروس",
          Manouba: "منوبة",
          Nabeul: "نابل",
          Zaghouan: "زغوان",
          Bizerte: "بنزرت",
          Beja: "باجة",
          Jendouba: "جندوبة",
          "Le Kef": "الكاف",
          Siliana: "سليانة",
          Kairouan: "القيروان",
          Kasserine: "القصرين",
          "Sidi Bouzid": "سيدي بوزيد",
          Sousse: "سوسة",
          Monastir: "المنستير",
          Mahdia: "المهدية",
          Sfax: "صفاقس",
          Gafsa: "قفصة",
          Tozeur: "توزر",
          Kebili: "قبلي",
          Gabes: "قابس",
          Medenine: "مدنين",
          Tataouine: "تطاوين",
        };
        return arGovs[gov] || gov;
      }
      return gov;
    },
    [language]
  );

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isRtl,
        formatNumber,
        formatDate,
        formatDateTime,
        formatCurrency,
        translateScale,
        translateHorizon,
        translateStatus,
        translateStage,
        translateDistrict,
        translateGovernorate,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
