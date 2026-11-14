import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  authCallbackMessages,
  type AuthCallbackMessages,
} from "./callback-messages.ts";
import { resolveReturnTo } from "./return-to.ts";
import { completeSignup } from "@/lib/analytics";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function asOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  return OTP_TYPES.has(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

function isCrossDeviceError(message: string): boolean {
  return /code verifier|pkce|no matching state|verifier not found/i.test(message);
}

function waitForSession(
  client: NonNullable<ReturnType<typeof getBrowserSupabase>>,
  timeoutMs: number,
): { promise: Promise<Session | null>; cancel: () => void } {
  let settled = false;
  let subscription: { unsubscribe: () => void } = { unsubscribe() {} };
  let timer = 0;
  let resolvePromise: (session: Session | null) => void = () => undefined;

  const finish = (session: Session | null) => {
    if (settled) return;
    settled = true;
    subscription.unsubscribe();
    window.clearTimeout(timer);
    resolvePromise(session);
  };

  const promise = new Promise<Session | null>((resolve) => {
    resolvePromise = resolve;
    const authChange = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    subscription = authChange.data.subscription;
    timer = window.setTimeout(() => {
      void client.auth.getSession().then(({ data }) => finish(data.session ?? null));
    }, timeoutMs);
  });

  return { promise, cancel: () => finish(null) };
}

interface AuthCallbackProps {
  messages?: AuthCallbackMessages;
}

export default function AuthCallback({
  messages: {
    loading = authCallbackMessages.en.loading,
    errorTitle = authCallbackMessages.en.errorTitle,
    missingState = authCallbackMessages.en.missingState,
    codeVerifier = authCallbackMessages.en.codeVerifier,
    resendPrompt = authCallbackMessages.en.resendPrompt,
    resendButton = authCallbackMessages.en.resendButton,
    resendSent = authCallbackMessages.en.resendSent,
    returnHome = authCallbackMessages.en.returnHome,
    tryAgain = authCallbackMessages.en.tryAgain,
  } = {},
}: AuthCallbackProps): React.JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signInWithOtp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const returnTo = resolveReturnTo({ returnTo: params.get("returnTo") });

  useEffect(() => {
    let cancelled = false;
    let cancelWait: (() => void) | null = null;

    const finish = async () => {
      const client = getBrowserSupabase();
      if (!client) {
        if (!cancelled) setError("Sign-in isn't configured in this environment.");
        return;
      }

      try {
        let session: Session | null = null;
        const tokenHash = params.get("token_hash");
        const otpType = asOtpType(params.get("type"));
        const code = params.get("code");

        if (tokenHash && otpType) {
          const { data, error: otpError } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (otpError) {
            if (!cancelled) setError(otpError.message);
            return;
          }
          session = data?.session ?? null;
        } else if (code) {
          const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) setError(exchangeError.message);
            return;
          }
          session = data?.session ?? null;
        }

        if (!session) {
          const { data } = await client.auth.getSession();
          session = data.session ?? null;
        }

        if (!session && !tokenHash && !code) {
          const pending = waitForSession(client, 1500);
          cancelWait = pending.cancel;
          session = await pending.promise;
          cancelWait = null;
          if (cancelled) return;
        }

        if (!session) {
          if (!cancelled) {
            setError("This sign-in link is missing or has expired. Request a new one.");
          }
          return;
        }

        try {
          await completeSignup({
            client,
            user: session.user,
          });
        } catch (upsertError) {
          console.error("Failed to create user:", upsertError);
        }

        if (!cancelled) navigate(returnTo, { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign-in failed";
        if (!cancelled) setError(message);
      }
    };

    void finish();
    return () => {
      cancelled = true;
      cancelWait?.();
    };
  }, [navigate, params, returnTo]);

  const onResend = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || resending) return;
    setResending(true);
    try {
      await signInWithOtp(email.trim());
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a sign-in link");
    } finally {
      setResending(false);
    }
  };

  if (error) {
    const crossDevice = isCrossDeviceError(error);
    const guidance =
      error === "No matching state found in storage"
        ? missingState
        : crossDevice
          ? codeVerifier
          : error;
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-medium text-destructive">{errorTitle}</p>
          <p className="max-w-md text-sm text-muted-foreground">{guidance}</p>
        </div>
        <form onSubmit={(e) => void onResend(e)} className="w-full max-w-sm space-y-3">
          <p className="text-center text-sm text-muted-foreground">{resendPrompt}</p>
          <div className="space-y-2 text-left">
            <Label htmlFor="callback-resend-email">Work email</Label>
            <Input
              id="callback-resend-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-11"
              disabled={resending || resent}
            />
          </div>
          {resent ? (
            <p className="rounded-xl border border-border bg-card p-3 text-sm">{resendSent}</p>
          ) : (
            <Button type="submit" className="h-11 w-full font-semibold" disabled={resending}>
              {resendButton}
            </Button>
          )}
        </form>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>
            {returnHome}
          </Button>
          <Button onClick={() => window.location.reload()}>{tryAgain}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4">
      <Spinner className="size-8" aria-label={loading} />
      <p className="text-sm text-muted-foreground">{loading}</p>
      <h1 className="text-2xl font-bold">Signing you in...</h1>
    </div>
  );
}
