import { supabase } from "../supabase";
import { jsonAuthHeaders } from "./bearer";

function rpcErrorMessage(error: { message?: string } | null): string {
  const raw = error?.message ?? "Something went wrong";
  if (/join code is not valid/i.test(raw)) return "That join code is not valid";
  if (/Too many join attempts/i.test(raw)) return "Too many join attempts. Try again in a few minutes.";
  if (/removed from this workspace/i.test(raw)) return "You were removed from this workspace and cannot rejoin";
  if (/Not authorized/i.test(raw)) return "You don’t have permission to do that";
  return raw;
}

/** Redeem a short team code; returns the workspace id. Adds the user as `member`. */
export async function redeemJoinCode(args: { code: string }): Promise<string> {
  const { data, error } = await supabase.rpc("redeem_join_code", {
    p_code: args.code.trim(),
  });
  if (error) throw new Error(rpcErrorMessage(error));
  if (!data || typeof data !== "string") throw new Error("Couldn’t join that team");
  return data;
}

export async function getWorkspaceJoinCode(args: { workspaceId: string }): Promise<string> {
  const { data, error } = await supabase.rpc("get_workspace_join_code", {
    p_workspace_id: args.workspaceId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  if (!data || typeof data !== "string") throw new Error("Couldn’t load join code");
  return data;
}

export async function regenerateWorkspaceJoinCode(args: { workspaceId: string }): Promise<string> {
  const { data, error } = await supabase.rpc("regenerate_workspace_join_code", {
    p_workspace_id: args.workspaceId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  if (!data || typeof data !== "string") throw new Error("Couldn’t regenerate join code");
  return data;
}

/** Email someone the current join code (editors only; server checks membership). */
export async function emailJoinCode(args: {
  workspaceId: string;
  email: string;
}): Promise<void> {
  const response = await fetch("/api/workspaces/join-code/email", {
    method: "POST",
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({
      workspaceId: args.workspaceId,
      email: args.email.trim(),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Couldn’t send invite email" }));
    throw new Error(typeof body.error === "string" ? body.error : "Couldn’t send invite email");
  }
}
