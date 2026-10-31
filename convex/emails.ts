"use node";

import { v } from "convex/values";
import { Hercules } from "@usehercules/sdk";
import { internalAction } from "./_generated/server";
import { EMAIL_FROM } from "./lib/emailTemplates";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY,
  apiVersion: "2025-12-09",
});

/** Sends each message on its own so recipients never see each other's addresses. */
export const send = internalAction({
  args: {
    messages: v.array(v.object({ to: v.string(), subject: v.string(), html: v.string(), text: v.string() })),
  },
  handler: async (_ctx, { messages }): Promise<null> => {
    for (const m of messages) {
      try {
        await hercules.email.send({ from: EMAIL_FROM, ...m });
      } catch (err) {
        // A failed update email must never break anything else; keep the detail in the logs.
        console.error("Update email failed", m.subject, err);
      }
    }
    return null;
  },
});
