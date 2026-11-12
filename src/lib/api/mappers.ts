import type { CommentKind, JobStatus, JobPhase } from "@/schema/validators";
import { hydrateFootageMedia, publicStorageOrigin } from "./storage-urls";

// Database row types (snake_case from Supabase)
export interface DbReel {
  id: string;
  workspace_id: string;
  study_id: string;
  position: number;
  track: string;
  track_index: number;
  title: string;
  scenes: any;
  finding_ids: any;
  topics?: string[] | null;
  source_names: any;
  footage: unknown;
  video?: unknown;
  art?: unknown;
  warning: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  studies?: {
    title: string;
    status?: string;
  };
}

export interface DbComment {
  id: string;
  reel_id: string;
  study_id: string;
  user_id: string | null;
  guest_id: string | null;
  parent_id: string | null;
  kind: CommentKind;
  body: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  users?: {
    name: string | null;
    email: string | null;
    avatar?: string | null;
  } | null;
}

export interface DbJob {
  id: string;
  study_id: string;
  workspace_id: string;
  status: JobStatus;
  phase: JobPhase;
  cursor: number;
  chunks: any;
  log: any;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbStudy {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description?: string;
  status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
  users?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export interface DbFinding {
  id: string;
  study_id: string;
  type: string;
  text: string;
  speaker?: string | null;
  number?: string | null;
  label?: string | null;
  created_at: string;
}

// UI types (camelCase for components)
export interface FeedReel {
  _id: string;
  id: string;
  _creationTime: number;
  workspaceId: string;
  studyId: string;
  position: number;
  track: string;
  trackIndex: number;
  title: string;
  scenes?: Scene[];
  findingIds?: string[];
  /** Lowercase subject tags. Empty until the insight has been tagged. */
  topics: string[];
  sourceNames?: string[];
  footage?: {
    url: string;
    caption: string;
    media?: "image" | "video";
    storageId?: string;
    bucket?: string;
  } | null;
  video?: {
    status?: string;
    error?: string;
    jobId?: string;
  } | null;
  warning: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  studyTitle?: string;
  seen?: boolean;
  saved?: boolean;
  counts?: {
    views?: number;
    reactions?: number;
    comments?: number;
  };
  reactions?: { heart: number };
  commentCount?: number;
}

export interface Scene {
  type: "hook" | "line" | "list" | "stat" | "quote" | "cta";
  text?: string;
  kicker?: string;
  title?: string;
  items?: string[];
  number?: string;
  num?: string;
  unit?: string;
  label?: string;
  subtitle?: string;
  attribution?: string;
  by?: string;
  sub?: string;
}

export interface Comment {
  _id: string;
  id: string;
  _creationTime: number;
  reelId: string;
  studyId: string;
  userId: string | null;
  guestId: string | null;
  parentId: string | null;
  kind: CommentKind;
  body: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export interface Finding {
  _id: string;
  id: string;
  _creationTime: number;
  studyId: string;
  type: string;
  text: string;
  speaker?: string;
  number?: string;
  label?: string;
  createdAt: string;
}

export interface Study {
  _id: string;
  id: string;
  _creationTime: number;
  workspaceId: string;
  createdBy: string;
  title: string;
  description?: string;
  status: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  _id: string;
  id: string;
  _creationTime: number;
  studyId: string;
  workspaceId: string;
  status: JobStatus;
  phase: JobPhase;
  cursor: number;
  totalChunks: number;
  log: any[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  _id: string;
  id: string;
  _creationTime: number;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: string;
  name?: string;
  email?: string;
  avatar?: string;
}

// Mapper functions
export function mapReel(row: DbReel): FeedReel {
  return {
    _id: row.id,
    id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    studyId: row.study_id,
    position: row.position,
    track: row.track,
    trackIndex: row.track_index,
    title: row.title,
    scenes: parseJson(row.scenes),
    findingIds: parseJson(row.finding_ids),
    topics: Array.isArray(row.topics) ? row.topics : [],
    sourceNames: parseJson(row.source_names),
    footage: hydrateFootageMedia(parseJson(row.footage), publicStorageOrigin()),
    video: parseJson(row.video),
    warning: row.warning,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    studyTitle: row.studies?.title,
  };
}

export function mapComment(row: DbComment): Comment {
  return {
    _id: row.id,
    id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    reelId: row.reel_id,
    studyId: row.study_id,
    userId: row.user_id,
    guestId: row.guest_id,
    parentId: row.parent_id,
    kind: row.kind,
    body: row.body,
    resolved: row.resolved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.users
      ? {
          name: row.users.name || undefined,
          email: row.users.email || undefined,
          avatar: row.users.avatar || undefined,
        }
      : undefined,
  };
}

export function mapJob(row: DbJob): Job {
  const chunks = parseJson(row.chunks) || [];
  return {
    _id: row.id,
    id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    studyId: row.study_id,
    workspaceId: row.workspace_id,
    status: row.status,
    phase: row.phase,
    cursor: row.cursor,
    totalChunks: Array.isArray(chunks) ? chunks.length : 0,
    log: parseJson(row.log) || [],
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStudy(row: DbStudy): Study {
  return {
    _id: row.id,
    id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    status: row.status,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMember(row: DbMember): Member {
  return {
    _id: row.id,
    id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    name: row.users?.name,
    email: row.users?.email,
    avatar: row.users?.avatar,
  };
}

export function mapFinding(row: DbFinding): Finding {
  return {
    _id: row.id,
    id: row.id,
    _creationTime: new Date(row.created_at).getTime(),
    studyId: row.study_id,
    type: row.type,
    text: row.text,
    speaker: row.speaker || undefined,
    number: row.number || undefined,
    label: row.label || undefined,
    createdAt: row.created_at,
  };
}

// Helper to safely parse JSON fields
function parseJson(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
