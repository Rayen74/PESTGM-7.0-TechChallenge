"use client";
import React, { useState } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/api";
import { Sun, ArrowRight, KeyRound, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setSuccessMessage(res.message);
      if (res.reset_token) {
        setResetToken(res.reset_token);
      }
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "Échec de l'envoi de la demande.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(resetToken, newPassword);
      setSuccessMessage(res.message);
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "Échec de la réinitialisation.");
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
            Récupération de Compte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            STEG Solar Platform • Réinitialisation du mot de passe
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {step === "request" ? "Mot de passe oublié" : "Nouveau mot de passe"}
              </h2>
              <p className="text-xs text-slate-500">
                {step === "request"
                  ? "Entrez l'adresse email associée à votre compte"
                  : "Définissez votre nouveau mot de passe sécurisé"}
              </p>
            </div>
            <KeyRound className="w-5 h-5 text-amber-400/80" />
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && step === "reset" && !error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {step === "request" ? (
            <form onSubmit={handleRequestToken} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="forgot-email">
                  Adresse email du compte
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Vérification…" : "Générer le lien de réinitialisation"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="reset-token">
                  Jeton de validation
                </label>
                <input
                  id="reset-token"
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Jeton JWT de réinitialisation"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
                />
              </div>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Mise à jour en cours…" : "Confirmer le nouveau mot de passe"}
                {!loading && <CheckCircle2 className="w-4 h-4" />}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à la connexion
            </Link>

            {step === "reset" && (
              <button
                type="button"
                onClick={() => setStep("request")}
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                Modifier l'email
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
