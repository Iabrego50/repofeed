import { timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";
import { supabase } from "./supabase.js";

export const GENERATION_INTERNAL_SECRET_HEADER = "x-generation-internal-secret";
export const EDIT_ROLES = ["owner", "editor"] as const;

export class AuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  if (error instanceof AuthError) return true;
  if (!(error instanceof Error) || error.name !== "AuthError") return false;
  const status = (error as AuthError).status;
  return status === 401 || status === 403;
}

export type HeaderSource =
  | Pick<VercelRequest, "headers">
  | { headers?: Headers | Record<string, string | string[] | undefined> }
  | Headers
  | Request;

type ServerClient = typeof supabase;

export function readHeader(source: HeaderSource | undefined, name: string): string | undefined {
  if (!source) return undefined;
  const headers = source instanceof Headers ? source : "headers" in source ? source.headers : source;
  if (!headers) return undefined;

  if (headers instanceof Headers) {
    return emptyToUndefined(headers.get(name) ?? headers.get(name.toLowerCase()));
  }

  if (typeof (headers as { get?: unknown }).get === "function") {
    const value = (headers as Headers).get(name) ?? (headers as Headers).get(name.toLowerCase());
    return emptyToUndefined(value);
  }

  const rec = headers as Record<string, string | string[] | undefined>;
  const direct =
    rec[name] ??
    rec[name.toLowerCase()] ??
    rec[name.toUpperCase()] ??
    rec[name.replace(/-/g, "_")] ??
    rec[name.replace(/-/g, "_").toLowerCase()];
  if (Array.isArray(direct)) return emptyToUndefined(direct[0]);
  return emptyToUndefined(direct);
}

function emptyToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function bearerToken(source: HeaderSource | undefined): string | undefined {
  const raw = readHeader(source, "authorization") ?? readHeader(source, "Authorization");
  if (!raw) return undefined;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return emptyToUndefined(match?.[1] ?? raw);
}

export function readInternalGenerationSecret(source: HeaderSource | undefined): string | undefined {
  return (
    readHeader(source, GENERATION_INTERNAL_SECRET_HEADER) ??
    readHeader(source, "generation-internal-secret") ??
    readHeader(source, "GENERATION_INTERNAL_SECRET") ??
    readHeader(source, "generation_internal_secret")
  );
}

export function secretsMatch(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function isInternalGenerationCall(
  source: HeaderSource | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return secretsMatch(readInternalGenerationSecret(source), env.GENERATION_INTERNAL_SECRET);
}

export async function requireUser(
  source: HeaderSource | undefined,
  client: ServerClient = supabase,
): Promise<User> {
  const token = bearerToken(source);
  if (!token) {
    throw new AuthError(401, "Unauthorized");
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError(401, "Unauthorized");
  }
  return data.user;
}

export async function canEditWorkspace(
  userId: string,
  workspaceId: string,
  client: ServerClient = supabase,
): Promise<boolean> {
  const { data, error } = await client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return (EDIT_ROLES as readonly string[]).includes(data.role);
}

export async function requireWorkspaceEditor(
  userId: string,
  workspaceId: string,
  client: ServerClient = supabase,
): Promise<void> {
  const allowed = await canEditWorkspace(userId, workspaceId, client);
  if (!allowed) {
    throw new AuthError(403, "Forbidden");
  }
}

export async function ensurePublicUser(
  user: User,
  client: ServerClient = supabase,
): Promise<string> {
  const { data } = await client.from("users").select("id").eq("id", user.id).maybeSingle();
  if (data?.id) return data.id;

  const metadata = user.user_metadata ?? {};
  const name = typeof metadata.name === "string" ? metadata.name : null;
  const { error } = await client.from("users").insert({
    id: user.id,
    token_identifier: user.id,
    email: user.email ?? null,
    name,
  });

  if (error && !/duplicate|unique/i.test(error.message)) {
    throw error;
  }
  return user.id;
}

export async function requireProcessAccess(
  source: HeaderSource | undefined,
  workspaceId: string,
  client: ServerClient = supabase,
  env: NodeJS.ProcessEnv = process.env,
): Promise<"internal" | "user"> {
  if (isInternalGenerationCall(source, env)) return "internal";
  const user = await requireUser(source, client);
  await requireWorkspaceEditor(user.id, workspaceId, client);
  return "user";
}
