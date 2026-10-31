// Schema validators - matching original Convex validators but for TypeScript types

export type Role = 'owner' | 'editor' | 'member';
export type InviteRole = 'editor' | 'member';
export type StudyStatus = 'draft' | 'processing' | 'published' | 'failed' | 'archived';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';
export type JobPhase = 'extracting' | 'composing' | 'done';
export type FindingType = 'insight' | 'quote' | 'stat' | 'recommendation' | 'context';
export type ReactionKind = 'true' | 'surprised' | 'pushback';
export type CommentKind = 'comment' | 'reply';

export interface Scene {
  type: 'hook' | 'line' | 'list' | 'stat' | 'quote' | 'cta';
  text?: string;
  kicker?: string;
  title?: string;
  items?: string[];
  num?: string;
  label?: string;
  by?: string;
  sub?: string; // For subtitle/secondary text
}

export interface Chunk {
  fileId: string;
  chunkIndex: number;
  text: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'error';
  message: string;
}

export interface DeckSlide {
  type: string;
  [key: string]: any;
}

export interface DeckStats {
  [key: string]: any;
}

export interface DeckReel {
  id: string;
  [key: string]: any;
}

// Type guards
export function isRole(value: string): value is Role {
  return ['owner', 'editor', 'member'].includes(value);
}

export function isStudyStatus(value: string): value is StudyStatus {
  return ['draft', 'processing', 'published', 'failed', 'archived'].includes(value);
}

export function isReactionKind(value: string): value is ReactionKind {
  return ['true', 'surprised', 'pushback'].includes(value);
}
