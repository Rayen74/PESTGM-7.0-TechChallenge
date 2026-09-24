"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/api";
import {
  Sun,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Copy,
  Mail,
} from "lucide-react";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();

  // "request" (entering email) | "sent" (link generated) | "reset" (setting new password)
  const [step, setStep] = useState<"request" | "sent" | "reset">("request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetUrl, setResetUrl] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // If a valid ?token= is provided in the URL query string, directly open the reset form
  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl && tokenFromUrl !== "undefined" && tokenFromUrl !== "null" && tokenFromUrl.trim().length > 10) {
      setResetToken(tokenFromUrl);
      setStep("reset");
    }
  }, [searchParams]);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      const rawToken = res.reset_token;

      if (!rawToken || rawToken === "undefined") {
        throw new Error("Impossible de générer le jeton de sécurité pour cet utilisateur.");
      }

      const generatedUrl =
        res.reset_url && !res.reset_url.includes("token=undefined")
          ? res.reset_url
          : `${window.location.origin}/forgot-password?token=${rawToken}`;

      setResetToken(rawToken);
      setResetUrl(generatedUrl);
      setStep("sent");
    } catch (err: any) {
      setError(err.message || "Échec de l'envoi de la demande de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!resetUrl) return;
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resetToken) {
      setError("Aucun jeton de réinitialisation valide détecté. Veuillez réouvrir le lien envoyé.");
      return;
    }

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
      await resetPassword(resetToken, newPassword);
      setPasswordResetSuccess(true);
    } catch (err: any) {
      setError(err.message || "Le lien ou jeton de réinitialisation est invalide ou a expiré.");
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
            STEG Solar Platform • Réinitialisation par lien sécurisé
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {passwordResetSuccess
                  ? "Mot de passe mis à jour !"
                  : step === "request"
                  ? "Mot de passe oublié"
                  : step === "sent"
                  ? "Lien de réinitialisation généré"
                  : "Nouveau mot de passe"}
              </h2>
              <p className="text-xs text-slate-500">
                {passwordResetSuccess
                  ? "Votre mot de passe a été modifié avec succès."
                  : step === "request"
                  ? "Entrez votre email pour obtenir un lien de récupération"
                  : step === "sent"
                  ? "Cliquez sur le lien ci-dessous pour changer votre mot de passe"
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

          {/* STEP: SUCCESS FINAL */}
          {passwordResetSuccess ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-200">Mot de passe réinitialisé</p>
                  <p className="text-emerald-400/80">
                    Vous pouvez dès maintenant vous connecter à votre espace avec vos nouveaux identifiants.
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
          ) : step === "request" ? (
            /* STEP 1: Enter email */
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
                {loading ? "Génération en cours…" : "Générer le lien de réinitialisation"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : step === "sent" ? (
            /* STEP 2: Display Generated Reset URL with direct click & copy */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                  <Mail className="w-4 h-4" />
                  <span>Lien de réinitialisation prêt (valable 1 heure) :</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 break-all font-mono text-[11px] text-amber-200/90 leading-relaxed select-all">
                  {resetUrl}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? "Lien copié !" : "Copier le lien"}</span>
                  </button>

                  <a
                    href={resetUrl}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Ouvrir le lien</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep("reset")}
                  className="text-xs text-amber-400/90 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/30 transition-colors"
                >
                  Ou continuer directement sur cette page →
                </button>
              </div>
            </div>
          ) : (
            /* STEP 3: Enter new password with token automatically attached (No JWT field) */
            <form onSubmit={handleResetPassword} className="space-y-4">
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

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à la connexion
            </Link>

            {(step === "sent" || step === "reset") && !passwordResetSuccess && (
              <button
                type="button"
                onClick={() => {
                  setStep("request");
                  setError(null);
                }}
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                Recommencer avec un autre email
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-sm">
          Chargement de la page de réinitialisation…
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
