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
      setError(err instanceof Error ? err.message : "Couldn't send a sign-in link");
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
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">Sign in</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Sign in to repofeed.ai</h1>
        <p className="mt-3 text-muted-foreground">
          {googleEnabled
            ? "Use Google or a magic link. After you sign in you'll land back where you left off."
            : "Use a magic link. After you sign in you'll land back where you left off."}
        </p>
        {sent ? (
          <p className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm">
            Check <span className="font-semibold">{email}</span> for a sign-in link. You can close this tab.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {googleEnabled && (
              <>
                <Button size="lg" className="h-12 w-full font-semibold" onClick={() => void onGoogle()} disabled={busy}>
                  Continue with Google
                </Button>
                <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
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
              <Button type="submit" variant="secondary" size="lg" className="h-12 w-full font-semibold" disabled={busy}>
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
