"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmailToken, resendEmailVerification } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Sun,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  MailCheck,
  RotateCcw,
} from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isRtl, formatNumber } = useI18n();

  const [tokenInput, setTokenInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    const queryToken = searchParams.get("token");
    if (queryToken) {
      setTokenInput(queryToken);
      autoVerify(queryToken);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const autoVerify = async (tok: string) => {
    setLoading(true);
    setStatus("idle");
    setErrorMessage(null);
    try {
      const res = await verifyEmailToken(tok);
      setStatus("success");
      setSuccessMessage(res.message || t.auth.verifySuccessTitle);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || t.auth.invalidTokenDefault);
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMessage(t.auth.tokenRequired);
      return;
    }
    await autoVerify(tokenInput.trim());
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;
    if (!emailInput.trim()) {
      setErrorMessage(t.auth.emailRequired);
      return;
    }

    setResending(true);
    setErrorMessage(null);
    try {
      const res = await resendEmailVerification(emailInput.trim());
      setSuccessMessage(t.auth.resendSuccess);
      setCooldown(30);

      if (res.token) {
        setTokenInput(res.token);
      }
    } catch (err: any) {
      setErrorMessage(err.message || t.auth.resendFailed);
    } finally {
      setResending(false);
    }
  };

  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#090d16] overflow-hidden py-12 px-4">
      {/* Top Language Selector */}
      <div className={`absolute top-6 ${isRtl ? "left-6" : "right-6"} z-30`}>
        <LanguageSelector />
      </div>

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,191,36,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />

      <div className="relative z-10 max-w-lg w-full">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 mb-4">
            <Sun className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
            {t.auth.verifyTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.auth.verifySubtitle}</p>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-slate-100">{t.auth.verifySecureValidation}</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>{t.auth.expiresIn4Min}</span>
            </div>
          </div>

          {/* Success banner */}
          {status === "success" && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{successMessage}</p>
                <p className="text-xs text-emerald-400/80 mt-1">
                  {t.auth.verifySuccessDesc}
                </p>
                <div className="mt-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors shadow-md"
                  >
                    <span>{t.auth.goToLogin}</span>
                    <ForwardIcon className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Error banner */}
          {status === "error" && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{t.auth.verifyFailedTitle}</p>
                <p className="text-xs text-rose-400/90 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Info notice */}
          {status !== "success" && (
            <form onSubmit={handleManualVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="verify-token">
                  {t.auth.verifyTokenLabel}
                </label>
                <textarea
                  id="verify-token"
                  rows={3}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={t.auth.verifyTokenPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all resize-none text-left rtl:text-right"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !tokenInput.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.auth.verifySubmitting}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t.auth.verifySubmit}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Resend Section */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-300">
                {t.auth.didNotReceiveEmail}
              </h3>
              {cooldown > 0 && (
                <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {t.auth.waitCooldown.replace("{cooldown}", formatNumber(cooldown))}
                </span>
              )}
            </div>

            <form onSubmit={handleResend} className="space-y-3">
              <div>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all text-left rtl:text-right"
                />
              </div>

              <button
                type="submit"
                disabled={resending || cooldown > 0 || !emailInput.trim()}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.auth.resendingButton}</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {cooldown > 0
                        ? t.auth.buttonActiveIn.replace("{cooldown}", formatNumber(cooldown))
                        : t.auth.resendButton}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Return to login link */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-xs text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1"
          >
            <span>{t.auth.backToLogin}</span>
            <ForwardIcon className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-sm">
          ...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
