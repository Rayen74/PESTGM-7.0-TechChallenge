"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Sun, ArrowRight, UserPlus, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { user, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stegContractNo, setStegContractNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace(user.role === "ADMIN" ? "/admin" : "/citizen");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await register({
        full_name: fullName,
        email,
        password,
        steg_contract_no: stegContractNo || undefined,
      });
      router.replace("/citizen");
    } catch (err: any) {
      setError(err.message || "Échec de la création du compte.");
    } finally {
      setLoading(false);
    }
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
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 mb-4">
            <Sun className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
            Inscription Citoyen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rejoignez le réseau d'auto-producteurs solaires &amp; stockage STEG
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Créer un compte</h2>
              <p className="text-xs text-slate-500">Remplissez les informations ci-dessous</p>
            </div>
            <UserPlus className="w-5 h-5 text-amber-400/80" />
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-name">
                Nom complet
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mohamed Ben Salem"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-email">
                Adresse email
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citoyen@exemple.tn"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-password">
                  Mot de passe
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-confirm">
                  Confirmation
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reg-steg">
                Numéro de contrat STEG <span className="text-slate-600">(Optionnel)</span>
              </label>
              <input
                id="reg-steg"
                type="text"
                value={stegContractNo}
                onChange={(e) => setStegContractNo(e.target.value)}
                placeholder="POL-123456-TUN"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Création du compte…" : "Créer mon compte citoyen"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center space-y-2">
            <p className="text-xs text-slate-400">
              Vous avez déjà un compte ?{" "}
              <Link
                href="/login"
                className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4 decoration-amber-400/40"
              >
                Se connecter
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              Vous devez valider votre email ?{" "}
              <Link
                href="/verify-email"
                className="text-slate-300 hover:text-amber-400 transition-colors underline underline-offset-4 decoration-slate-600"
              >
                Confirmer l'adresse email
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
