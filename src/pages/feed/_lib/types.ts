import type { Scene } from '@/schema/validators';

export interface FeedReel {
  id: string;
  title: string;
  track: string;
  scenes?: Scene[];
  studyTitle?: string;
  studyId?: string;
  workspaceId?: string;
  createdAt?: string;
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
