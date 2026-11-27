import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  EMAIL_OTP_MAX_LENGTH,
  isValidEmailOtp,
  normalizeEmailOtp,
  shouldAutoSubmitEmailOtp,
} from "@/lib/email-otp";
import SlopShell, { SlopBrand, SlopPill } from "@/components/slop/slop-shell.tsx";
import { FEED_PATH } from "@/app-paths.ts";
import { cn } from "@/lib/utils.ts";
import { resolveReturnTo } from "./return-to.ts";

const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";
/** Sign in with Apple — enable after configuring the Apple provider in Supabase (App Store 4.8). */
const appleEnabled = import.meta.env.VITE_ENABLE_APPLE_AUTH === "true";
const RESEND_SECONDS = 30;

export default function SignInPage() {
  const { signIn, signInWithOtp, verifyEmailOtp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = resolveReturnTo({ returnTo: params.get("returnTo") });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  const onOAuth = async (provider: "google" | "apple") => {
    setBusy(true);
    setError(null);
    try {
      await signIn(provider);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : provider === "apple"
            ? "Couldn't start Apple sign-in"
            : "Couldn't start Google sign-in",
      );
      setBusy(false);
    }
  };

  const sendLink = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithOtp(email.trim());
      setSent(true);
      setCode("");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t send the email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const onEmail = async (e: FormEvent) => {
    e.preventDefault();
    await sendLink();
  };

  const verifyCode = async (token: string) => {
    if (!isValidEmailOtp(token) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email.trim(), token);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn’t work. Check it and try again.");
      setBusy(false);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    await verifyCode(code);
  };

  const applyCode = (value: string) => {
    const digits = normalizeEmailOtp(value);
    setCode(digits);
    setError(null);
    if (shouldAutoSubmitEmailOtp(digits)) void verifyCode(digits);
  };

  const onCodeChange = (value: string) => {
    applyCode(value);
  };

  /** Normalize before maxLength truncates pasted "4056-7273" / "4056 7273". */
  const onCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    applyCode(e.clipboardData.getData("text"));
  };

  const useDifferentEmail = () => {
    setSent(false);
    setCode("");
    setError(null);
    setBusy(false);
    setCooldown(0);
  };

  const fromStory = returnTo.startsWith("/welcome") || returnTo === "/studies/new";

  return (
    <SlopShell>
      <header className="slop-navbar relative z-20">
        <div className="slop-navbar-inner flex-wrap px-6 py-2">
          <Link to="/" aria-label="repofeed.ai home">
            <SlopBrand />
          </Link>
          <div className="slop-row">
            {fromStory ? (
              <span className="slop-status">
                <span className="slop-dot slop-dot-green" />
                Preview mode
              </span>
            ) : null}
            <Link
              to={fromStory ? "/welcome" : "/demo"}
              className="slop-btn slop-btn-ghost"
              style={{ minHeight: 44 }}
            >
              {fromStory ? "Back to the story" : "Watch the demo"}
            </Link>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 m-auto w-full flex-1 px-6 pb-12 pt-6",
          fromStory
            ? "grid max-w-[1200px] items-center gap-10 lg:grid-cols-2 lg:gap-16"
            : "max-w-md",
        )}
      >
        <div className="rf-rise flex flex-col items-start gap-5">
          <SlopPill dot={fromStory ? "green" : "purple"}>
            {fromStory ? "One step from air" : "Welcome back"}
          </SlopPill>
          <h1 className="slop-h1 m-0 text-balance" style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)" }}>
            {fromStory ? (
              <>
                Sign <span className="slop-underline slop-underline-double">in</span> to{" "}
                <span className="slop-serif-emphasis slop-text-gradient-hot">keep</span> your channel.
              </>
            ) : (
              <>
                Sign in to <span className="slop-serif-emphasis slop-text-gradient-hot">repofeed</span>
                <span style={{ color: "#94a3b8" }}>.ai</span>
              </>
            )}
          </h1>
          <p className="slop-lead m-0 max-w-[44ch]">
            {fromStory
              ? "Everything you just set up comes with you — next stop: your first study."
              : googleEnabled || appleEnabled
                ? "New here or coming back, it’s the same step. Use a sign-in button below, or we’ll email you a link and a sign-in code. There’s no password to remember."
                : "New here or coming back, it’s the same step. We’ll email you a link and a sign-in code, and there’s no password to remember."}
          </p>

          {sent ? (
            <div className="mt-2 flex w-full flex-col gap-4">
              <p role="status" className="slop-card m-0 text-[0.9375rem]">
                We sent a sign-in link and a code to <span className="font-semibold">{email}</span>. Enter the
                code from your email here, or open the link on this device. If it hasn’t arrived in a minute, check
                spam.
              </p>
              <form onSubmit={(e) => void onVerify(e)} className="flex w-full flex-col gap-3">
                <label htmlFor="signin-otp" className="text-sm font-semibold">
                  Sign-in code
                </label>
                <div className="slop-ai-bar" style={{ minHeight: 56 }}>
                  <input
                    ref={codeRef}
                    id="signin-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6,8}"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={EMAIL_OTP_MAX_LENGTH}
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    onPaste={onCodePaste}
                    placeholder="Enter code"
                    disabled={busy}
                    aria-label="Sign-in code from your email"
                    style={{ height: 44, textAlign: "center", letterSpacing: "0.4em", fontSize: 18, fontWeight: 600 }}
                  />
                </div>
                <button
                  type="submit"
                  className="slop-btn slop-btn-primary slop-btn-lg w-full"
                  disabled={busy || !isValidEmailOtp(code)}
                >
                  {busy ? "Signing you in…" : "Verify code"}
                </button>
              </form>
              <div className="slop-row w-full flex-wrap">
                <button
                  type="button"
                  className="slop-btn slop-btn-ghost flex-1"
                  disabled={busy || cooldown > 0}
                  onClick={() => void sendLink()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
                </button>
                <button
                  type="button"
                  className="slop-btn slop-btn-ghost flex-1"
                  disabled={busy}
                  onClick={useDifferentEmail}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex w-full flex-col gap-3.5">
              {(googleEnabled || appleEnabled) && (
                <>
                  {appleEnabled && (
                    <button
                      type="button"
                      className="slop-btn slop-btn-ghost slop-btn-lg w-full"
                      onClick={() => void onOAuth("apple")}
                      disabled={busy}
                    >
                      Continue with Apple
                    </button>
                  )}
                  {googleEnabled && (
                    <button
                      type="button"
                      className="slop-btn slop-btn-primary slop-btn-lg w-full"
                      onClick={() => void onOAuth("google")}
                      disabled={busy}
                    >
                      Continue with Google
                    </button>
                  )}
                  <div className="slop-row w-full text-xs" style={{ color: "#94a3b8" }}>
                    <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
                    or email
                    <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
                  </div>
                </>
              )}
              <form onSubmit={(e) => void onEmail(e)} className="flex w-full flex-col gap-3">
                <label htmlFor="signin-email" className="text-sm font-semibold">
                  Work email
                </label>
                <div className="slop-ai-bar" style={{ minHeight: 56 }}>
                  <span aria-hidden>✨</span>
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    disabled={busy}
                    style={{ height: 44, fontSize: 18 }}
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    "slop-btn slop-btn-lg w-full",
                    googleEnabled || appleEnabled ? "slop-btn-ghost" : "slop-btn-primary",
                  )}
                  disabled={busy}
                >
                  {busy ? "Sending…" : "Email me a sign-in link"}
                </button>
              </form>
            </div>
          )}

          {error && (
            <p className="m-0 text-sm" style={{ color: "#f87171" }} role="alert">
              {error}
            </p>
          )}

          {fromStory && (
            <p className="m-0 max-w-[44ch] text-sm" style={{ color: "#94a3b8" }}>
              By continuing you agree to the{" "}
              <Link to="/terms" className="underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          )}
          {returnTo !== FEED_PATH && !fromStory && (
            <p className="m-0 text-xs" style={{ color: "#94a3b8" }}>
              You&apos;ll return to {returnTo} after signing in.
            </p>
          )}
        </div>

        {fromStory && (
          <aside className="rf-rise flex min-h-[280px] items-center justify-center">
            <div className="slop-card slop-card-beam flex w-full max-w-[440px] flex-col gap-5 p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="slop-row">
                  <span className="slop-icon-box mb-0" aria-hidden>
                    📺
                  </span>
                  <span
                    className="font-mono text-[13px] tracking-[0.12em] uppercase"
                    style={{ color: "#94a3b8" }}
                  >
                    Your channel
                  </span>
                </span>
                <span className="slop-status">
                  <span className="slop-dot slop-dot-amber" />
                  Not saved yet
                </span>
              </div>
              <div className="slop-text-gradient text-4xl font-extrabold tracking-tight">Team research</div>
              <dl className="m-0 flex flex-col">
                {(
                  [
                    ["Tuned for", "Researcher"],
                    ["On air", "Interviews · Usability tests"],
                    ["Watching", "My team"],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-3.5"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <dt className="text-[15px]" style={{ color: "#94a3b8" }}>
                      {label}
                    </dt>
                    <dd className="m-0 text-right text-[15px] font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        )}
      </main>
    </SlopShell>
  );
}
