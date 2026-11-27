import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { sendRouteError } from "../_lib/respond.js";

/**
 * Optional notify for story demo leads.
 * Skips entirely when RESEND_API_KEY is unset — the client already inserted
 * into public.demo_requests; this route only emails hello@repofeed.ai.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!key) {
    // Resend is not configured in this environment — skip quietly.
    return res.status(204).end();
  }

  try {
    const email = String((req.body as { email?: string } | undefined)?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email is required" });
    }

    const resend = new Resend(key);
    await resend.emails.send({
      from: "repofeed.ai <no-reply@repofeed.ai>",
      to: ["hello@repofeed.ai"],
      subject: `Demo request: ${email}`,
      text: `New story demo request from ${email}.\nSource: story onboarding.`,
      html: `<p>New story demo request from <strong>${email}</strong>.</p><p>Source: story onboarding.</p>`,
    });

    return res.status(204).end();
  } catch (error) {
    return sendRouteError(res, error, "Couldn’t send demo notify email");
  }
}
