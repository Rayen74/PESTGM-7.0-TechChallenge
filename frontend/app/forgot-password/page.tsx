"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Sun,
  ArrowRight,
  ArrowLeft,
  Mail,
  Clock,
  ShieldCheck,
} from "lucide-react";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const { t, isRtl } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [emailDelivered, setEmailDelivered] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [fallbackResetUrl, setFallbackResetUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      window.location.href = `/reset-password?token=${encodeURIComponent(token)}`;
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setEmailDelivered(null);
    setDebugInfo(null);
    setFallbackResetUrl(null);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setSubmitted(true);
      if (res) {
        setEmailDelivered((res as any).email_delivered ?? null);
        setDebugInfo((res as any).debug_info ?? null);
        setFallbackResetUrl((res as any).reset_url ?? null);
      }
    } catch (err: any) {
      setError(err.message || t.auth.errorSendingReset);
    } finally {
      setLoading(false);
    }
  };

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#090d16] overflow-hidden py-12 px-4">
      {/* Top language selector */}
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

      <div className="relative z-10 max-w-md w-full">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 mb-4">
            <Sun className="w-8 h-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
            {t.auth.forgotTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.auth.forgotSubtitle}</p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{t.auth.forgotHeading}</h2>
              <p className="text-xs text-slate-500">
                {submitted ? t.auth.forgotPromptSubmitted : t.auth.forgotPrompt}
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-amber-400/80" />
          </div>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {submitted ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-amber-200">
                    {t.auth.resetLinkSentTitle}
                  </p>
                  <p className="text-amber-400/80">
                    {t.auth.resetLinkSentDesc}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300/70 pt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t.auth.linkValidityNotice}</span>
                  </div>
                </div>
              </div>

              {emailDelivered === false && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <span>{t.auth.smtpNoticeTitle}</span>
                  </div>
                  <p className="text-[12px] text-slate-300 leading-relaxed">
                    {t.auth.smtpNoticeDesc}
                  </p>
                  {fallbackResetUrl && (
                    <div className="pt-1">
                      <a
                        href={fallbackResetUrl}
                        className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all shadow-md shadow-amber-500/20"
                      >
                        <span>{t.auth.openResetDirectly}</span>
                        <ForwardIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                  {debugInfo && (
                    <p className="text-[10px] font-mono text-slate-500 break-all pt-1">
                      Detail: {debugInfo}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                  setEmailDelivered(null);
                  setDebugInfo(null);
                  setFallbackResetUrl(null);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                {t.auth.sendAnotherLink}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="forgot-email">
                  {t.auth.emailLabel}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all text-left rtl:text-right"
                />
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{t.auth.securityRateLimit}</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {loading ? t.auth.forgotSubmitting : t.auth.forgotSubmit}
                {!loading && <ForwardIcon className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <BackIcon className="w-3.5 h-3.5" />
              {t.auth.backToLogin}
            </Link>

            <Link
              href="/login"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              {t.auth.loginLink}
            </Link>
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
          ...
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
