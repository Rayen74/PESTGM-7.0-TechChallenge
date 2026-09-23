import React from "react";
import { Sun, Activity, ShieldCheck, Zap } from "lucide-react";

interface HeaderProps {
  activeModel?: string;
  isHealthy?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeModel = "keras_nn",
  isHealthy = true,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Flag & Titles */}
        <div className="flex items-center gap-3.5">
          <div className="relative w-11 h-8 rounded overflow-hidden shadow-md border border-slate-700 shrink-0">
            {/* Tunisia Flag SVG */}
            <svg viewBox="0 0 1200 800" className="w-full h-full object-cover">
              <rect width="1200" height="800" fill="#E70013" />
              <circle cx="600" cy="400" r="200" fill="#FFFFFF" />
              <circle cx="600" cy="400" r="150" fill="#E70013" />
              <circle cx="640" cy="400" r="120" fill="#FFFFFF" />
              {/* Star */}
              <polygon
                points="560,400 600,412 575,380 575,420 600,388"
                fill="#E70013"
                transform="rotate(0 580 400)"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
                Système National de Prévision Solaire & Dispatch STEG
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Sun className="w-3.5 h-3.5 animate-spin-slow" />
                Live Grid
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Plateforme prédictive multi-échelles (National, Districts, Gouvernorats) avec estimation d&apos;incertitude en continu.
            </p>
          </div>
        </div>

        {/* Right: Badges */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Modèle Actif :</span>
            <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40">
              {activeModel}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className="text-slate-300">{isHealthy ? "API Météo Active" : "Flux Dégradé"}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
