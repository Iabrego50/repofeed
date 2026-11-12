import { jsonAuthHeaders } from "./bearer";
import type { AskResult } from "../research-search";

export type AskResponse = AskResult & { notice?: "ai_unavailable" };

async function post<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: await jsonAuthHeaders(), body: JSON.stringify(body) });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || fallbackError);
  }
  return (await response.json()) as T;
}

/** Asks the workspace's research a question. Falls back to keyword matches on the server when the AI is unavailable. */
export function askResearch(args: { workspaceId: string; question: string; topics?: string[] }): Promise<AskResponse> {
  return post("/api/insights/ask", args, "That question didn’t go through. Try again.");
}

/** Tags up to 40 untagged insights with topics. */
export function tagTopics(args: { workspaceId: string }): Promise<{ tagged: number; remaining: number; notice?: string }> {
  return post("/api/insights/topics", args, "Topics couldn’t be added right now.");
}
