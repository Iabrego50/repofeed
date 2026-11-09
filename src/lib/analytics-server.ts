import type { AnalyticsEvent } from "./analytics";

type ServerClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{
      error: { message?: string } | null;
    }>;
  };
};

export type ServerTrackArgs = {
  event: AnalyticsEvent;
  userId?: string | null;
  workspaceId?: string | null;
  path?: string | null;
  properties?: Record<string, string | number | boolean | null | undefined>;
  anonymousId?: string | null;
  sessionId?: string | null;
};

function cleanProperties(
  properties: ServerTrackArgs["properties"],
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!properties) return out;
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Insert a product event from a Vercel API route or webhook (service role). */
export async function trackServer(
  client: ServerClient,
  args: ServerTrackArgs,
): Promise<void> {
  try {
    const { error } = await client.from("analytics_events").insert({
      event: args.event,
      user_id: args.userId ?? null,
      workspace_id: args.workspaceId ?? null,
      anonymous_id: args.anonymousId ?? null,
      session_id: args.sessionId ?? null,
      path: args.path ?? null,
      properties: cleanProperties(args.properties),
    });
    if (error) {
      console.error(`[analytics] failed to insert ${args.event}:`, error.message);
    }
  } catch (error) {
    console.error(`[analytics] failed to insert ${args.event}:`, error);
  }
}
