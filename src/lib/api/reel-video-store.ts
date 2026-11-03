import {
  VIDEO_BUCKET,
  type ReelVideo,
  type ReelVideoRow,
} from "./reel-video.js";
import type { ReelVideoStore } from "./reel-video-jobs.js";

function asRow(row: Record<string, unknown>): ReelVideoRow {
  return {
    id: String(row.id),
    study_id: String(row.study_id),
    workspace_id: String(row.workspace_id),
    title: String(row.title ?? ""),
    track: String(row.track ?? ""),
    track_index: Number(row.track_index ?? 0),
    scenes: row.scenes,
    footage: (row.footage as ReelVideoRow["footage"]) ?? null,
    art: (row.art as ReelVideoRow["art"]) ?? null,
    video: (row.video as ReelVideo | null) ?? null,
    enabled: row.enabled !== false,
  };
}

const REEL_COLUMNS =
  "id, study_id, workspace_id, title, track, track_index, scenes, footage, art, video, enabled";

type QueryResult = { data?: unknown; error?: { message: string } | null };

type StoreClient = {
  from: (table: string) => {
    select: (columns: string) => Chain;
    update: (patch: unknown) => {
      eq: (column: string, value: unknown) => Promise<QueryResult>;
    };
  };
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        bytes: Uint8Array,
        options?: {
          contentType?: string;
          upsert?: boolean;
          cacheControl?: string;
        },
      ) => Promise<QueryResult>;
    };
  };
};

type Chain = PromiseLike<QueryResult> & {
  select: (columns: string) => Chain;
  eq: (column: string, value: unknown) => Chain;
  or: (expr: string) => Chain;
  ilike: (column: string, value: string) => Chain;
  order: (column: string, options?: { ascending?: boolean }) => Chain;
  limit: (n: number) => Chain;
  maybeSingle: () => PromiseLike<QueryResult>;
};

export function createReelVideoStore(client: object): ReelVideoStore {
  const db = client as StoreClient;
  return {
    async listByStudy(studyId) {
      const { data, error } = await db
        .from("reels")
        .select(REEL_COLUMNS)
        .eq("study_id", studyId);
      if (error) throw error;
      return ((data as Record<string, unknown>[]) ?? []).map(asRow);
    },

    async listPending(limit) {
      const { data, error } = await db
        .from("reels")
        .select(REEL_COLUMNS)
        .or(
          "video->>status.eq.queued,video->>status.eq.starting,video->>status.eq.in_progress,video->>status.eq.failed",
        )
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return ((data as Record<string, unknown>[]) ?? []).map(asRow);
    },

    async listEligible(args) {
      let query = db.from("reels").select(REEL_COLUMNS).eq("enabled", true);
      if (args.studyId) query = query.eq("study_id", args.studyId);
      if (args.reelId) query = query.eq("id", args.reelId);
      if (args.titleContains)
        query = query.ilike("title", `%${args.titleContains}%`);
      const { data, error } = await query
        .order("created_at", { ascending: true })
        .limit(args.limit);
      if (error) throw error;
      return ((data as Record<string, unknown>[]) ?? []).map(asRow);
    },

    async updateReel(id, patch) {
      const { error } = await db.from("reels").update(patch).eq("id", id);
      if (error) throw error;
    },

    async workspacePlan(workspaceId) {
      const { data, error } = await db
        .from("workspaces")
        .select("paid_plan")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      const plan =
        data && typeof data === "object" && "paid_plan" in data
          ? data.paid_plan
          : null;
      return typeof plan === "string" ? plan : null;
    },

    async uploadVideo(path, bytes) {
      const { error } = await db.storage
        .from(VIDEO_BUCKET)
        .upload(path, bytes, {
          contentType: "video/mp4",
          upsert: false,
          cacheControl: "3600",
        });
      if (error) throw error;
    },
  };
}
