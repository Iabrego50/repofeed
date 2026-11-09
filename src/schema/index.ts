export type { StudyStatus, Role, InviteRole, Plan } from './validators';
export type {
  SceneStep,
  SceneItem,
  Scene,
  JobStatus,
  JobPhase,
  JobContext,
  CommentKind,
  ReactionType,
  DeckSlide,
} from './validators';

// Database types
export interface Study {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  description?: string;
  status: 'draft' | 'generating' | 'review' | 'published' | 'archived';
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  customer_id?: string;
  paid_plan?: 'pro' | 'team';
  lapsed_plan?: 'pro' | 'team';
  seat_variant?: string;
  seats?: number;
  seat_overage?: boolean;
  billing_return_url?: string;
  checkout_by?: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'member';
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  token_identifier: string;
  onboarded_at?: string;
  trial_used_at?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  signup_referrer?: string;
  landing_path?: string;
  is_admin?: boolean;
  created_at: string;
}

import type { Scene } from './validators';

export interface Reel {
  id: string;
  workspace_id: string;
  study_id: string;
  created_by: string;
  title: string;
  text: string;
  scenes?: Scene[];
  footage?: { url: string; caption: string; media?: "image" | "video" } | null;
  video_url?: string;
  created_at: string;
  updated_at: string;
}
