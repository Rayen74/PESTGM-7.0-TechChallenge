"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import {
  Sun,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpiredOrUsed, setIsExpiredOrUsed] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const rawToken = searchParams.get("token");
    if (rawToken && rawToken.trim().length > 10) {
      setToken(rawToken.trim());
    } else {
      setError("Aucun jeton de réinitialisation détecté dans l'URL.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsExpiredOrUsed(false);

    if (!token) {
      setError("Jeton de sécurité manquant. Veuillez recliquer sur le lien reçu par email.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg.includes("Invalid or expired") ||
        msg.includes("invalide ou a expiré") ||
        msg.includes("déjà été utilisé") ||
        msg.includes("expiré")
      ) {
        setIsExpiredOrUsed(true);
        setError("Ce lien a expiré ou a déjà été utilisé. Veuillez effectuer une nouvelle demande.");
      } else {
        setError(msg || "Échec de la réinitialisation du mot de passe.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#090d16] overflow-hidden py-12 px-4">
      {/* Background decorations */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,191,36,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />

      <div className="relative z-10 max-w-md w-full">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 mb-4">
            <Sun className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
            Nouveau Mot de Passe
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            STEG Solar Platform • Validation de sécurité 4-minutes
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Réinitialisation</h2>
              <p className="text-xs text-slate-500">Choisissez votre nouveau mot de passe</p>
            </div>
            <KeyRound className="w-5 h-5 text-amber-400/80" />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">{error}</p>
                {isExpiredOrUsed && (
                  <p className="text-rose-300/80 text-[11px]">
                    Les liens de réinitialisation expirent au bout de 4 minutes pour protéger votre compte.
                  </p>
                )}
              </div>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-200">Mot de passe réinitialisé avec succès</p>
                  <p className="text-emerald-400/80">
                    Votre mot de passe a été mis à jour. Vous pouvez dès à présent vous connecter.
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-sm"
              >
                <span>Accéder à la connexion</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : isExpiredOrUsed ? (
            <div className="space-y-4 pt-1">
              <Link
                href="/forgot-password"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-sm"
              >
                <span>Demander un nouveau lien</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="new-password">
                  Nouveau mot de passe
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="confirm-new-password">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                <Clock className="w-3.5 h-3.5" />
                <span>Ce lien est à usage unique et expire 4 minutes après l'envoi.</span>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {loading ? "Mise à jour en cours…" : "Confirmer le nouveau mot de passe"}
                {!loading && <CheckCircle2 className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à la connexion
            </Link>

            <Link
              href="/forgot-password"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              Demander un lien
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-sm">
          Chargement du formulaire de réinitialisation…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
