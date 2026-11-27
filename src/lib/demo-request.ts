import { getBrowserSupabase } from "@/lib/supabase.ts";

/** Same shape as the SlopMain artboard client check. */
export const DEMO_EMAIL_RE = /^[^@ ]+@[^@ ]+[.][^@ ]+$/;

export const DEMO_EMAIL_ERROR =
  "That doesn’t look like an email address. Check it and try again.";

export function isValidDemoEmail(email: string): boolean {
  return DEMO_EMAIL_RE.test(email.trim());
}

/**
 * Insert a story demo lead. No `.select()` — RLS is INSERT-only for anon /
 * authenticated, so RETURNING would fail SELECT policies.
 */
export async function submitDemoRequest(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!isValidDemoEmail(trimmed)) {
    throw new Error(DEMO_EMAIL_ERROR);
  }

  const client = getBrowserSupabase();
  if (!client) {
    throw new Error("Couldn’t reach the server. Try again in a moment.");
  }

  // No .select() — RLS is INSERT-only for anon/authenticated.
  const { error } = await client.from("demo_requests").insert({
    email: trimmed.toLowerCase(),
    source: "story",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : null,
  });

  if (error) {
    throw new Error(error.message || "Couldn’t save your demo request. Try again.");
  }

  // Best-effort notify hello@ — /api/demo-requests/notify no-ops when RESEND_API_KEY is unset.
  try {
    void fetch("/api/demo-requests/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed.toLowerCase() }),
    });
  } catch {
    /* ignore network errors; the row is already saved */
  }
}
