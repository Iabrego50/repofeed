import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import Logo from "@/components/logo.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import { FEED_PATH } from "@/app-paths.ts";
import { resolveReturnTo } from "./return-to.ts";

const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";
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

  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn("google");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start Google sign-in");
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
    if (token.length !== 6 || busy) return;
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

  const onCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
    if (digits.length === 6) void verifyCode(digits);
  };

  const useDifferentEmail = () => {
    setSent(false);
    setCode("");
    setError(null);
    setBusy(false);
    setCooldown(0);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 py-5">
        <Link to="/" aria-label="repofeed.ai home">
          <Logo />
        </Link>
        <Link to="/demo" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Watch the demo
        </Link>
      </header>
      <main className="relative m-auto w-full max-w-md px-5 pb-16">
        <h1 className="text-3xl font-bold tracking-tight">Sign in to repofeed.ai</h1>
        <p className="mt-3 text-muted-foreground">
          {googleEnabled
            ? "New here or coming back, it’s the same step. Use Google, or we’ll email you a link and a 6-digit code. There’s no password to remember."
            : "New here or coming back, it’s the same step. We’ll email you a link and a 6-digit code, and there’s no password to remember."}
        </p>
        {sent ? (
          <div className="mt-8 space-y-4">
            <p role="status" className="rounded-xl border border-border bg-card p-5 text-[0.9375rem]">
              We sent a sign-in link and a 6-digit code to <span className="font-semibold">{email}</span>. Enter the code here, or open the link on this device. If it hasn’t arrived in a minute, check spam.
            </p>
            <form onSubmit={(e) => void onVerify(e)} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signin-otp">6-digit code</Label>
                <Input
                  ref={codeRef}
                  id="signin-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  placeholder="000000"
                  className="h-12 tracking-[0.4em] text-center text-lg font-semibold"
                  disabled={busy}
                  aria-label="6-digit sign-in code"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 w-full font-semibold" disabled={busy || code.length !== 6}>
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
            {googleEnabled && (
              <>
                <Button size="lg" className="h-12 w-full font-semibold" onClick={() => void onGoogle()} disabled={busy}>
                  Continue with Google
                </Button>
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
              <Button type="submit" variant={googleEnabled ? "outline" : "default"} size="lg" className="h-12 w-full font-semibold" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </form>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {returnTo !== FEED_PATH && (
          <p className="mt-4 text-xs text-muted-foreground">You'll return to {returnTo} after signing in.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
