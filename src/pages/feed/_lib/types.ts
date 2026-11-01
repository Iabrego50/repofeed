import type { Scene } from '@/schema/validators';

export interface FeedReel {
  id: string;
  _id?: string;
  title: string;
  track: string;
  track_index?: number;
  trackIndex?: number;
  position: number;
  scenes?: Scene[];
  finding_ids?: any;
  source_names?: string[];
  sourceNames?: string[];
  studyTitle?: string;
  studyId?: string;
  workspaceId?: string;
  workspace_id?: string;
  study_id?: string;
  enabled?: boolean;
  footage?: any;
  art?: any;
  warning?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  seen?: boolean;
  saved?: boolean;
  counts?: {
    views?: number;
    reactions?: number;
    comments?: number;
  };
}

export interface FeedComment {
  id: string;
  body: string;
  kind: string;
  userId?: string;
  guestId?: string;
  authorName?: string;
  createdAt: string;
  resolved?: boolean;
  parentId?: string | null;
}
