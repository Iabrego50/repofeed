import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  EMAIL_OTP_MAX_LENGTH,
  isValidEmailOtp,
  normalizeEmailOtp,
  shouldAutoSubmitEmailOtp,
} from "@/lib/email-otp";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import Logo from "@/components/logo.tsx";
import SiteFooter from "@/components/site-footer.tsx";
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="repofeed.ai home">
          <Logo />
        </Link>
        <Link
          to={fromStory ? "/welcome" : "/demo"}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {fromStory ? "Back to the story" : "Watch the demo"}
        </Link>
      </header>
      <main
        className={cn(
          "relative m-auto w-full px-5 pb-16",
          fromStory ? "grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center" : "max-w-md",
        )}
      >
        <div>
        <p className="font-mono text-[11px] tracking-[0.16em] text-eyebrow uppercase">
          {fromStory ? "One step from air" : "Welcome back"}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {fromStory ? "Sign in to keep your channel." : "Sign in to repofeed.ai"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {fromStory
            ? "Everything you just set up comes with you. Next stop: your first study."
            : googleEnabled || appleEnabled
              ? "New here or coming back, it’s the same step. Use a sign-in button below, or we’ll email you a link and a sign-in code. There’s no password to remember."
              : "New here or coming back, it’s the same step. We’ll email you a link and a sign-in code, and there’s no password to remember."}
        </p>
        {sent ? (
          <div className="mt-8 space-y-4">
            <p role="status" className="rounded-xl border border-border bg-card p-5 text-[0.9375rem]">
              We sent a sign-in link and a code to <span className="font-semibold">{email}</span>. Enter the code from your email here, or open the link on this device. If it hasn’t arrived in a minute, check spam.
            </p>
            <form onSubmit={(e) => void onVerify(e)} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signin-otp">Sign-in code</Label>
                <Input
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
                  className="h-12 tracking-[0.4em] text-center text-lg font-semibold"
                  disabled={busy}
                  aria-label="Sign-in code from your email"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 w-full font-semibold" disabled={busy || !isValidEmailOtp(code)}>
                {busy ? "Signing you in…" : "Verify code"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                disabled={busy || cooldown > 0}
                onClick={() => void sendLink()}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
              </Button>
              <Button type="button" variant="ghost" className="h-11 flex-1" disabled={busy} onClick={useDifferentEmail}>
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {(googleEnabled || appleEnabled) && (
              <>
                {appleEnabled && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full font-semibold"
                    onClick={() => void onOAuth("apple")}
                    disabled={busy}
                  >
                    Continue with Apple
                  </Button>
                )}
                {googleEnabled && (
                  <Button size="lg" className="h-12 w-full font-semibold" onClick={() => void onOAuth("google")} disabled={busy}>
                    Continue with Google
                  </Button>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or email
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
            <form onSubmit={(e) => void onEmail(e)} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Work email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11"
                  disabled={busy}
                />
              </div>
              <Button type="submit" variant={googleEnabled || appleEnabled ? "outline" : "default"} size="lg" className="h-12 w-full font-semibold" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </form>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {fromStory && (
          <p className="mt-6 text-xs text-muted-foreground">
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
          <p className="mt-4 text-xs text-muted-foreground">You'll return to {returnTo} after signing in.</p>
        )}
        </div>

        {fromStory && (
          <aside className="rounded-[1.5rem] border border-border bg-card p-6 shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Your channel</p>
              <span className="rounded-full bg-mark px-2.5 py-0.5 text-[11px] font-semibold text-mark-foreground">
                Not saved yet
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Team research</h2>
            <dl className="mt-5 divide-y divide-border text-sm">
              {(
                [
                  ["Tuned for", "Researcher"],
                  ["On air", "Interviews · Usability tests"],
                  ["Watching", "My team"],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
