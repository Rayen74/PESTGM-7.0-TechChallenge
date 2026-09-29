import React from "react";

export const Header: React.FC<{ isHealthy?: boolean }> = ({ isHealthy = true }) => (
  <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-40 px-6 py-5">
    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-amber-400">Solar forecast</h1><p className="text-sm text-slate-400 mt-1">A clear view of expected solar production across Tunisia.</p></div>
      <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300"><span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-red-400"}`} />{isHealthy ? "Weather data is up to date" : "Weather data needs attention"}</div>
    </div>
  </header>
);
