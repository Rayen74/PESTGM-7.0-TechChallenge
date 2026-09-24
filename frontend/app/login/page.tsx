"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getDemoCredentials } from "@/lib/auth";
import { Sun, ArrowRight, ShieldCheck, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const demoCreds = getDemoCredentials();

  // Redirect if already logged in — route by role
  useEffect(() => {
    if (user) {
      router.replace(user.role === "ADMIN" ? "/admin" : "/citizen");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      router.replace(loggedUser.role === "ADMIN" ? "/admin" : "/citizen");
    } catch (err: any) {
      setError(err.message || "Identifiants invalides");
    } finally {
      setLoading(false);
    }
  };

  const fillCreds = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#090d16] overflow-hidden py-12 px-4">
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,191,36,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />

      <div className="relative z-10 max-w-md w-full">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 mb-4">
            <Sun className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
            STEG Solar Platform
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Système National de Prévision Solaire &amp; Gestion Batterie
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Connexion</h2>
              <p className="text-xs text-slate-500">Accédez à votre espace Citoyen ou STEG Admin</p>
            </div>
            <ShieldCheck className="w-5 h-5 text-amber-400/80" />
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="login-email">
                Adresse email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-400" htmlFor="login-password">
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-amber-400/90 hover:text-amber-300 transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Connexion en cours…" : "Se connecter"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              Nouveau citoyen producteur solaire ?{" "}
              <Link
                href="/register"
                className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4 decoration-amber-400/40"
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </div>

        {/* Demo credentials helper */}
        <div className="mt-6 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur p-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Comptes de test pré-configurés
          </h3>
          <div className="space-y-2.5">
            {demoCreds.map((u) => (
              <button
                key={u.role}
                type="button"
                onClick={() => fillCreds(u.email, u.password)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60 hover:border-slate-600 transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      u.role === "ADMIN" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    }`}
                  />
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">
                      {u.role === "ADMIN" ? "Administrateur STEG" : "Citoyen Auto-Producteur"}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {u.email}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-amber-400/70 group-hover:text-amber-300 font-mono">
                  {u.password}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
