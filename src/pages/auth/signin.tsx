import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import Logo from "@/components/logo.tsx";
import SiteFooter from "@/components/site-footer.tsx";
import { resolveReturnTo } from "./return-to.ts";

const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";

export default function SignInPage() {
  const { signIn, signInWithOtp } = useAuth();
  const [params] = useSearchParams();
  const returnTo = resolveReturnTo({ returnTo: params.get("returnTo") });
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const onEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithOtp(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t send the link. Check the address and try again.");
    } finally {
      setBusy(false);
    }
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
            ? "New here or coming back, it’s the same step. Use Google, or we’ll email you a link. There’s no password to remember."
            : "New here or coming back, it’s the same step. We’ll email you a link, and there’s no password to remember."}
        </p>
        {sent ? (
          <p role="status" className="mt-8 rounded-xl border border-border bg-card p-5 text-[0.9375rem]">
            We sent a sign-in link to <span className="font-semibold">{email}</span>. Open it on this device. If it hasn’t arrived in a minute, check spam.
          </p>
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
                Email me a sign-in link
              </Button>
            </form>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {returnTo !== "/" && (
          <p className="mt-4 text-xs text-muted-foreground">You'll return to {returnTo} after signing in.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
