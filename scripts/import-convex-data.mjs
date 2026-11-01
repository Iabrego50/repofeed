#!/usr/bin/env node
/**
 * Import a Convex database snapshot into Supabase.
 *
 * Requires Node 22+ (supabase-js uses the WebSocket global).
 *
 * Usage:
 *   export SUPABASE_URL=https://xxxxx.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *   node scripts/import-convex-data.mjs /path/to/db-snapshot.zip
 *   node scripts/import-convex-data.mjs /path/to/db-snapshot.zip --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

/** Fixed namespace so non-user rows get the same UUID on every rerun. */
export const CONVEX_ID_NAMESPACE = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

/** Convex snapshot folder name -> public Supabase table. */
export const TABLE_MAP = {
  users: "users",
  workspaces: "workspaces",
  workspaceMembers: "workspace_members",
  workspaceInvites: "workspace_invites",
  workspaceRemovals: "workspace_removals",
  emailPrefs: "email_prefs",
  uploadClaims: "upload_claims",
  studies: "studies",
  sources: "sources",
  findings: "findings",
  reels: "reels",
  footageClips: "footage_clips",
  generationJobs: "generation_jobs",
  reactions: "reactions",
  shareLinks: "share_links",
  guests: "guests",
  guestReactions: "guest_reactions",
  guestViews: "guest_views",
  comments: "comments",
  reelViews: "reel_views",
  savedReels: "saved_reels",
  reelCounters: "reel_counters",
  decks: "decks",
};

/** Transient Convex tables we do not import. */
export const SKIP_TABLES = {
  rateLimits: "transient rate-limit windows; not migrated",
};

const IMPORT_ORDER = [
  "users",
  "workspaces",
  "workspaceMembers",
  "workspaceInvites",
  "workspaceRemovals",
  "emailPrefs",
  "uploadClaims",
  "studies",
  "sources",
  "findings",
  "footageClips",
  "reels",
  "generationJobs",
  "reactions",
  "shareLinks",
  "guests",
  "guestReactions",
  "guestViews",
  "comments",
  "reelViews",
  "savedReels",
  "reelCounters",
  "decks",
];

const STUDY_STATUS = {
  draft: "draft",
  processing: "generating",
  generating: "generating",
  review: "review",
  published: "published",
  failed: "archived",
  archived: "archived",
};

const JOB_STATUS = {
  pending: "queued",
  queued: "queued",
  running: "running",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
};

const JOB_PHASE = {
  extracting: "extract",
  extract: "extract",
  composing: "compose",
  compose: "compose",
  done: "done",
};

const COMMENT_KIND = {
  comment: "note",
  reply: "note",
  note: "note",
  question: "question",
  action: "action",
};

const MEMBER_ROLE = {
  owner: "owner",
  admin: "owner",
  editor: "editor",
  member: "member",
  viewer: "member",
};

const INVITE_ROLE = {
  editor: "editor",
  member: "member",
  owner: "editor",
  admin: "editor",
  viewer: "member",
};

export function uuidFromConvexId(convexId, namespace = CONVEX_ID_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(String(convexId)).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function convertTimestamp(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== "" && !String(value).includes("T")) {
    return new Date(asNumber).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function convertTimestampOrNow(value) {
  return convertTimestamp(value) ?? new Date().toISOString();
}

function mapEnum(value, table, fallback) {
  if (value == null || value === "") return fallback;
  const mapped = table[value] ?? table[String(value).toLowerCase()];
  return mapped ?? fallback ?? value;
}

export function parseSnapshotTables(zip) {
  /** @type {Map<string, object[]>} */
  const tables = new Map();
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const match = name.match(/(?:^|\/)([^/]+)\/documents\.jsonl$/);
    if (!match) continue;
    tables.set(match[1], null);
  }
  return tables;
}

async function readJsonlFromZip(zip, folder) {
  const file = Object.values(zip.files).find((entry) => {
    if (entry.dir) return false;
    return new RegExp(`(?:^|/)${folder}/documents\\.jsonl$`).test(entry.name);
  });
  if (!file) return [];
  const text = await file.async("string");
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) records.push(JSON.parse(line));
  }
  return records;
}

async function loadZip(options) {
  if (options.zip) return options.zip;
  if (options.zipBuffer) return JSZip.loadAsync(options.zipBuffer);
  if (!options.zipPath) throw new Error("zipPath or zipBuffer is required");
  const buffer = await readFile(options.zipPath);
  return JSZip.loadAsync(buffer);
}

function defaultLog(message) {
  console.log(message);
}

function createIdResolver() {
  const idMap = new Map();
  function resolve(convexId) {
    if (convexId == null || convexId === "") return null;
    const key = String(convexId);
    if (idMap.has(key)) return idMap.get(key);
    const uuid = uuidFromConvexId(key);
    idMap.set(key, uuid);
    return uuid;
  }
  function remember(convexId, uuid) {
    idMap.set(String(convexId), uuid);
    return uuid;
  }
  return { resolve, remember, idMap };
}

function userEmail(record) {
  if (record.email) return String(record.email);
  const token = record.tokenIdentifier || record.token_identifier;
  if (typeof token === "string" && token.includes("@") && !token.includes("://")) return token;
  const slug = String(record._id).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `convex-${slug}@imported.local`;
}

async function findAuthUserByEmail(supabase, email) {
  if (!email || !supabase.auth?.admin) return null;
  if (typeof supabase.auth.admin.listUsers === "function") {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    return users.find((u) => u.email === email) ?? null;
  }
  return null;
}

async function upsertRows(supabase, table, rows) {
  if (rows.length === 0) return;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
    if (error) {
      throw new Error(`upsert ${table} (batch ${i}): ${error.message}`);
    }
  }
}

async function ensureAuthUser(supabase, record, ids, log) {
  const email = userEmail(record);
  const metadata = {
    name: record.name ?? null,
    avatar_url: record.avatar ?? record.avatarUrl ?? null,
  };

  const { data: existingPublic, error: publicError } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (publicError) throw new Error(`lookup public.users by email: ${publicError.message}`);
  if (existingPublic?.id) {
    ids.remember(record._id, existingPublic.id);
    return existingPublic.id;
  }

  const existingAuth = await findAuthUserByEmail(supabase, email);
  if (existingAuth?.id) {
    ids.remember(record._id, existingAuth.id);
    return existingAuth.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) {
    const again = await findAuthUserByEmail(supabase, email);
    if (again?.id) {
      ids.remember(record._id, again.id);
      log(`  ℹ users: reused auth user ${email}`);
      return again.id;
    }
    throw new Error(`createUser(${email}): ${error.message}`);
  }
  const authId = data?.user?.id;
  if (!authId) throw new Error(`createUser(${email}) returned no user id`);
  ids.remember(record._id, authId);
  return authId;
}

function remapFootage(footage, resolve) {
  if (!footage || typeof footage !== "object") return footage ?? null;
  const next = { ...footage };
  if (next.clipId) next.clipId = resolve(next.clipId);
  if (next.storageId) next.storageId = resolve(next.storageId);
  if (next.source && typeof next.source === "object") {
    next.source = { ...next.source };
    if (next.source.clipId) next.source.clipId = resolve(next.source.clipId);
  }
  return next;
}

function remapDeckReels(reels, resolve) {
  if (!Array.isArray(reels)) return [];
  return reels.map((reel) => {
    if (!reel || typeof reel !== "object") return reel;
    const next = { ...reel };
    if (next.id) next.id = resolve(next.id);
    return next;
  });
}

function transformRecord(folder, record, resolve) {
  switch (folder) {
    case "workspaces":
      return {
        id: resolve(record._id),
        name: record.name,
        created_by: resolve(record.createdBy),
        customer_id: record.customerId ?? null,
        seat_variant: record.seatVariant ?? null,
        seats: record.seats ?? null,
        billing_return_url: record.billingReturnUrl ?? null,
        checkout_by: record.checkoutBy ? resolve(record.checkoutBy) : null,
        paid_plan: record.paidPlan ?? null,
        lapsed_plan: record.lapsedPlan ?? null,
        seat_overage: record.seatOverage ?? false,
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "workspaceMembers":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        user_id: resolve(record.userId),
        role: mapEnum(record.role, MEMBER_ROLE, "member"),
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "workspaceInvites":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        token: record.token,
        role: mapEnum(record.role, INVITE_ROLE, "member"),
        expires_at: convertTimestamp(record.expiresAt) ?? new Date(Date.now() + 30 * 86400000).toISOString(),
        created_by: resolve(record.createdBy),
        revoked: record.revoked ?? false,
        uses: record.uses ?? 0,
        max_uses: record.maxUses ?? null,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "workspaceRemovals":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        user_id: resolve(record.userId),
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "emailPrefs":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        user_id: resolve(record.userId),
        new_studies: record.newStudies ?? true,
        feedback: record.feedback ?? true,
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "uploadClaims":
      return {
        id: resolve(record._id),
        storage_id: resolve(record.storageId),
        workspace_id: resolve(record.workspaceId),
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "studies":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        title: record.title,
        audience: record.audience,
        goal: record.goal ?? null,
        status: mapEnum(record.status, STUDY_STATUS, "draft"),
        tracks: record.tracks ?? [],
        created_by: resolve(record.createdBy),
        published_at: convertTimestamp(record.publishedAt),
        last_error: record.lastError ?? null,
        is_demo: record.isDemo ?? false,
        deleting: record.deleting ?? false,
        share_enabled: record.shareEnabled ?? false,
        share_token: record.shareToken ?? null,
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "sources":
      return {
        id: resolve(record._id),
        study_id: resolve(record.studyId),
        workspace_id: resolve(record.workspaceId),
        name: record.name,
        kind: record.kind,
        storage_id: record.storageId ? resolve(record.storageId) : null,
        text: record.text ?? "",
        chars: record.chars ?? String(record.text ?? "").length,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "findings":
      return {
        id: resolve(record._id),
        study_id: resolve(record.studyId),
        source_id: resolve(record.sourceId),
        chunk_index: record.chunkIndex ?? 0,
        type: record.type,
        text: record.text,
        speaker: record.speaker ?? null,
        number: record.number ?? null,
        label: record.label ?? null,
        strength: record.strength ?? 1,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "reels":
      return {
        id: resolve(record._id),
        study_id: resolve(record.studyId),
        workspace_id: resolve(record.workspaceId),
        position: record.position ?? 0,
        track: record.track,
        track_index: record.trackIndex ?? 0,
        title: record.title,
        scenes: record.scenes ?? [],
        finding_ids: (record.findingIds ?? []).map((id) => resolve(id)),
        source_names: record.sourceNames ?? [],
        warning: record.warning ?? null,
        enabled: record.enabled !== false,
        footage: remapFootage(record.footage, resolve),
        art: record.art ?? null,
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "footageClips":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        storage_id: resolve(record.storageId),
        url: record.url ?? String(record.storageId ?? ""),
        name: record.name,
        size: record.size ?? 0,
        uploaded_by: resolve(record.uploadedBy),
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "generationJobs":
      return {
        id: resolve(record._id),
        study_id: resolve(record.studyId),
        workspace_id: resolve(record.workspaceId),
        status: mapEnum(record.status, JOB_STATUS, "queued"),
        phase: mapEnum(record.phase, JOB_PHASE, "extract"),
        cursor: record.cursor ?? 0,
        chunks: record.chunks ?? [],
        attempts: record.attempts ?? 0,
        log: record.log ?? [],
        locked_until: convertTimestamp(record.lockedUntil) ?? new Date().toISOString(),
        error: record.error ?? null,
        error_detail: record.errorDetail ?? null,
        started_by: resolve(record.startedBy),
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "reactions":
      return {
        id: resolve(record._id),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        user_id: resolve(record.userId),
        kind: record.kind,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "shareLinks":
      return {
        id: resolve(record._id),
        study_id: resolve(record.studyId),
        workspace_id: resolve(record.workspaceId),
        token: record.token,
        created_by: resolve(record.createdBy),
        revoked: record.revoked ?? false,
        hide_team_comments: record.hideTeamComments ?? false,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "guests":
      return {
        id: resolve(record._id),
        study_id: resolve(record.studyId),
        link_id: resolve(record.linkId),
        name: record.name,
        secret: record.secret,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "guestReactions":
      return {
        id: resolve(record._id),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        guest_id: resolve(record.guestId),
        kind: record.kind,
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "guestViews":
      return {
        id: resolve(record._id),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        guest_id: resolve(record.guestId),
        view_count: record.viewCount ?? 0,
        completed: record.completed ?? false,
        last_viewed_at: convertTimestampOrNow(record.lastViewedAt ?? record._creationTime),
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "comments":
      return {
        id: resolve(record._id),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        user_id: record.userId ? resolve(record.userId) : null,
        guest_id: record.guestId ? resolve(record.guestId) : null,
        parent_id: record.parentId ? resolve(record.parentId) : null,
        kind: mapEnum(record.kind, COMMENT_KIND, "note"),
        body: record.body,
        resolved: record.resolved ?? false,
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "reelViews":
      return {
        id: resolve(record._id),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        user_id: resolve(record.userId),
        view_count: record.viewCount ?? 0,
        completed: record.completed ?? false,
        last_viewed_at: convertTimestampOrNow(record.lastViewedAt ?? record._creationTime),
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "savedReels":
      return {
        id: resolve(record._id),
        user_id: resolve(record.userId),
        workspace_id: resolve(record.workspaceId),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        created_at: convertTimestampOrNow(record._creationTime),
      };
    case "reelCounters":
      return {
        id: resolve(record._id),
        reel_id: resolve(record.reelId),
        study_id: resolve(record.studyId),
        true_count: record.trueCount ?? 0,
        surprised_count: record.surprisedCount ?? 0,
        pushback_count: record.pushbackCount ?? 0,
        comment_count: record.commentCount ?? 0,
        open_count: record.openCount ?? 0,
        guest_comment_count: record.guestCommentCount ?? 0,
        guest_open_count: record.guestOpenCount ?? 0,
        views: record.views ?? 0,
        viewers: record.viewers ?? 0,
        completions: record.completions ?? 0,
        created_at: convertTimestampOrNow(record._creationTime),
        updated_at: convertTimestampOrNow(record._creationTime),
      };
    case "decks":
      return {
        id: resolve(record._id),
        workspace_id: resolve(record.workspaceId),
        scope: record.scope === "all" ? "all" : resolve(record.scope),
        scope_label: record.scopeLabel,
        created_by: resolve(record.createdBy),
        slides: record.slides ?? [],
        stats: record.stats ?? {},
        reels: remapDeckReels(record.reels, resolve),
        created_at: convertTimestampOrNow(record._creationTime),
      };
    default:
      throw new Error(`No transformer for mapped folder ${folder}`);
  }
}

function planSnapshot(folderNames, recordsByFolder, log) {
  const unknown = [];
  const planned = [];
  for (const folder of folderNames) {
    const records = recordsByFolder.get(folder) ?? [];
    if (SKIP_TABLES[folder]) {
      log(`  ↷ ${folder}: ${records.length} record(s) skipped (${SKIP_TABLES[folder]})`);
      planned.push({ folder, table: null, count: records.length, skip: SKIP_TABLES[folder] });
      continue;
    }
    const table = TABLE_MAP[folder];
    if (!table) {
      if (records.length > 0) unknown.push({ folder, count: records.length });
      else log(`  ↷ ${folder}: empty unmapped folder, ignored`);
      continue;
    }
    log(`  • ${folder} → ${table}: ${records.length} record(s)`);
    planned.push({ folder, table, count: records.length, skip: null });
  }
  if (unknown.length > 0) {
    const detail = unknown.map((u) => `${u.folder} (${u.count})`).join(", ");
    throw new Error(`Snapshot has unmapped table(s) with records: ${detail}`);
  }
  return planned;
}

/**
 * @typedef {{ dryRun: boolean, counts: {[folder: string]: number}, idMap: Map<string, string> }} ImportResult
 *
 * @param {{
 *   zipPath?: string,
 *   zipBuffer?: Buffer | Uint8Array,
 *   zip?: import("jszip"),
 *   supabase?: object,
 *   dryRun?: boolean,
 *   log?: (msg: string) => void,
 * }} options
 * @returns {Promise<ImportResult>}
 */
export async function runImport(options) {
  const log = options.log ?? defaultLog;
  const dryRun = Boolean(options.dryRun);
  const zip = await loadZip(options);
  const folders = [...parseSnapshotTables(zip).keys()].sort();

  /** @type {Map<string, object[]>} */
  const recordsByFolder = new Map();
  for (const folder of folders) {
    recordsByFolder.set(folder, await readJsonlFromZip(zip, folder));
  }

  log(dryRun ? "🔍 Dry run — mapping snapshot tables\n" : "🚀 Importing Convex snapshot\n");
  const planned = planSnapshot(folders, recordsByFolder, log);

  const counts = {};
  for (const item of planned) {
    counts[item.folder] = item.count;
  }

  if (dryRun) {
    log("\n✅ Dry run complete (no writes)");
    return { dryRun: true, counts, idMap: new Map() };
  }

  if (!options.supabase) {
    throw new Error("supabase client is required unless --dry-run");
  }

  const ids = createIdResolver();
  const supabase = options.supabase;

  for (const folder of IMPORT_ORDER) {
    if (!recordsByFolder.has(folder)) continue;
    if (SKIP_TABLES[folder]) continue;
    const table = TABLE_MAP[folder];
    const records = recordsByFolder.get(folder) ?? [];
    if (records.length === 0) {
      log(`  ℹ ${folder}: no records`);
      continue;
    }

    if (folder === "users") {
      const rows = [];
      for (const record of records) {
        const authId = await ensureAuthUser(supabase, record, ids, log);
        rows.push({
          id: authId,
          token_identifier: record.tokenIdentifier || record.token_identifier || `convex:${record._id}`,
          name: record.name ?? null,
          email: userEmail(record),
          avatar: record.avatar ?? record.avatarUrl ?? null,
          onboarded_at: convertTimestamp(record.onboardedAt),
          trial_used_at: convertTimestamp(record.trialUsedAt),
          created_at: convertTimestampOrNow(record._creationTime),
          updated_at: convertTimestampOrNow(record._creationTime),
        });
      }
      await upsertRows(supabase, "users", rows);
      log(`  ✓ users: upserted ${rows.length} (auth + public)`);
      continue;
    }

    let transformed = records.map((record) => transformRecord(folder, record, ids.resolve));
    if (folder === "comments") {
      transformed = [
        ...transformed.filter((row) => !row.parent_id),
        ...transformed.filter((row) => row.parent_id),
      ];
    }
    await upsertRows(supabase, table, transformed);
    log(`  ✓ ${folder} → ${table}: upserted ${transformed.length}`);
  }

  log("\n✅ Import complete");
  return { dryRun: false, counts, idMap: ids.idMap };
}

/**
 * Previous importer: snake_case folders + insert public.users without auth.users.
 * Exported so tests can prove it fails on a real-shaped schema / camelCase zip.
 */
export async function runLegacyImport(options) {
  const zip = await loadZip(options);
  const supabase = options.supabase;
  const idMap = new Map();
  const getUUID = (convexId) => {
    if (!idMap.has(convexId)) idMap.set(convexId, randomUUID());
    return idMap.get(convexId);
  };

  const users = await readJsonlFromZip(zip, "users");
  if (users.length > 0) {
    const rows = users.map((record) => ({
      id: getUUID(record._id),
      token_identifier: record.tokenIdentifier,
      name: record.name || null,
      email: record.email || null,
      avatar: record.avatar || null,
      created_at: convertTimestampOrNow(record._creationTime),
      updated_at: convertTimestampOrNow(record._creationTime),
    }));
    const { error } = await supabase.from("users").insert(rows);
    if (error) throw new Error(error.message);
  }

  const members = await readJsonlFromZip(zip, "workspace_members");
  return { users: users.length, workspace_members: members.length };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    zipPath: args.find((arg) => !arg.startsWith("--")),
  };
}

export async function main(argv = process.argv) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    console.error(`Error: Node 22+ is required (supabase-js needs WebSocket). Running ${process.version}.`);
    process.exitCode = 1;
    return;
  }
  const { dryRun, zipPath } = parseArgs(argv);
  if (!zipPath) {
    console.error("Usage: node scripts/import-convex-data.mjs <path-to-db-snapshot.zip> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  let supabase;
  if (!dryRun) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
      process.exitCode = 1;
      return;
    }
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  await runImport({ zipPath, supabase, dryRun });
}

const launchedDirectly = Boolean(process.argv[1]?.endsWith("import-convex-data.mjs"));
if (launchedDirectly) {
  main().catch((error) => {
    console.error("\n❌ Import failed:", error.message);
    process.exitCode = 1;
  });
}
