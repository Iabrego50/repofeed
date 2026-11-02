import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getBrowserSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  authCallbackMessages,
  type AuthCallbackMessages,
} from "./callback-messages.ts";
import { resolveReturnTo } from "./return-to.ts";

interface AuthCallbackProps {
  messages?: AuthCallbackMessages;
}

export default function AuthCallback({
  messages: {
    loading = authCallbackMessages.en.loading,
    errorTitle = authCallbackMessages.en.errorTitle,
    missingState = authCallbackMessages.en.missingState,
    returnHome = authCallbackMessages.en.returnHome,
    tryAgain = authCallbackMessages.en.tryAgain,
  } = {},
}: AuthCallbackProps): React.JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const returnTo = resolveReturnTo({ returnTo: params.get("returnTo") });

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const client = getBrowserSupabase();
      if (!client) {
        if (!cancelled) setError("Sign-in isn't configured in this environment.");
        return;
      }

      try {
        const code = params.get("code");
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (!cancelled) setError(exchangeError.message);
            return;
          }
        }

        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) {
          if (!cancelled) setError(sessionError.message);
          return;
        }

        if (!data.session) {
          if (!cancelled) setError("No session found");
          return;
        }

        const { error: upsertError } = await client.from("users").upsert(
          {
            id: data.session.user.id,
            email: data.session.user.email,
            name: data.session.user.user_metadata?.name,
            avatar: data.session.user.user_metadata?.avatar_url,
            token_identifier: data.session.user.id,
          },
          { onConflict: "id" },
        );
        if (upsertError) console.error("Failed to create user:", upsertError);

        if (!cancelled) navigate(returnTo, { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign-in failed";
        if (!cancelled) setError(message);
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, params, returnTo]);

  if (error) {
    const guidance = error === "No matching state found in storage" ? missingState : error;
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-medium text-destructive">{errorTitle}</p>
          <p className="max-w-md text-sm text-muted-foreground">{guidance}</p>
        </div>
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
