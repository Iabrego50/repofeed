// Auto-generated database types from Supabase migrations
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          token_identifier: string
          name: string | null
          email: string | null
          avatar: string | null
          onboarded_at: string | null
          trial_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          token_identifier: string
          name?: string | null
          email?: string | null
          avatar?: string | null
          onboarded_at?: string | null
          trial_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          token_identifier?: string
          name?: string | null
          email?: string | null
          avatar?: string | null
          onboarded_at?: string | null
          trial_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          created_by: string
          customer_id: string | null
          seat_variant: string | null
          seats: number | null
          billing_return_url: string | null
          checkout_by: string | null
          paid_plan: string | null
          lapsed_plan: string | null
          seat_overage: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          customer_id?: string | null
          seat_variant?: string | null
          seats?: number | null
          billing_return_url?: string | null
          checkout_by?: string | null
          paid_plan?: string | null
          lapsed_plan?: string | null
          seat_overage?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          customer_id?: string | null
          seat_variant?: string | null
          seats?: number | null
          billing_return_url?: string | null
          checkout_by?: string | null
          paid_plan?: string | null
          lapsed_plan?: string | null
          seat_overage?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'editor' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'editor' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'member'
          created_at?: string
        }
      }
      workspace_invites: {
        Row: {
          id: string
          workspace_id: string
          token: string
          role: 'editor' | 'member'
          expires_at: string
          created_by: string
          revoked: boolean
          uses: number
          max_uses: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          token: string
          role: 'editor' | 'member'
          expires_at: string
          created_by: string
          revoked?: boolean
          uses?: number
          max_uses?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          token?: string
          role?: 'editor' | 'member'
          expires_at?: string
          created_by?: string
          revoked?: boolean
          uses?: number
          max_uses?: number | null
          created_at?: string
        }
      }
      workspace_removals: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          created_at?: string
        }
      }
      email_prefs: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          new_studies: boolean
          feedback: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          new_studies?: boolean
          feedback?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          new_studies?: boolean
          feedback?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          window_start: string
          count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          window_start: string
          count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          window_start?: string
          count?: number
          created_at?: string
          updated_at?: string
        }
      }
      upload_claims: {
        Row: {
          id: string
          storage_id: string
          workspace_id: string
          created_at: string
        }
        Insert: {
          id?: string
          storage_id: string
          workspace_id: string
          created_at?: string
        }
        Update: {
          id?: string
          storage_id?: string
          workspace_id?: string
          created_at?: string
        }
      }
      studies: {
        Row: {
          id: string
          workspace_id: string
          title: string
          audience: string
          goal: string | null
          status: 'draft' | 'generating' | 'review' | 'published' | 'archived'
          tracks: Json
          created_by: string
          published_at: string | null
          last_error: string | null
          is_demo: boolean | null
          deleting: boolean
          share_enabled: boolean
          share_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          audience: string
          goal?: string | null
          status: 'draft' | 'generating' | 'review' | 'published' | 'archived'
          tracks?: Json
          created_by: string
          published_at?: string | null
          last_error?: string | null
          is_demo?: boolean | null
          deleting?: boolean
          share_enabled?: boolean
          share_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          audience?: string
          goal?: string | null
          status?: 'draft' | 'generating' | 'review' | 'published' | 'archived'
          tracks?: Json
          created_by?: string
          published_at?: string | null
          last_error?: string | null
          is_demo?: boolean | null
          deleting?: boolean
          share_enabled?: boolean
          share_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sources: {
        Row: {
          id: string
          study_id: string
          workspace_id: string
          name: string
          kind: 'file' | 'paste'
          storage_id: string | null
          text: string
          chars: number
          created_at: string
        }
        Insert: {
          id?: string
          study_id: string
          workspace_id: string
          name: string
          kind: 'file' | 'paste'
          storage_id?: string | null
          text: string
          chars: number
          created_at?: string
        }
        Update: {
          id?: string
          study_id?: string
          workspace_id?: string
          name?: string
          kind?: 'file' | 'paste'
          storage_id?: string | null
          text?: string
          chars?: number
          created_at?: string
        }
      }
      findings: {
        Row: {
          id: string
          study_id: string
          source_id: string
          chunk_index: number
          type: 'insight' | 'quote' | 'stat' | 'recommendation' | 'context'
          text: string
          speaker: string | null
          number: string | null
          label: string | null
          strength: number
          created_at: string
        }
        Insert: {
          id?: string
          study_id: string
          source_id: string
          chunk_index: number
          type: 'insight' | 'quote' | 'stat' | 'recommendation' | 'context'
          text: string
          speaker?: string | null
          number?: string | null
          label?: string | null
          strength: number
          created_at?: string
        }
        Update: {
          id?: string
          study_id?: string
          source_id?: string
          chunk_index?: number
          type?: 'insight' | 'quote' | 'stat' | 'recommendation' | 'context'
          text?: string
          speaker?: string | null
          number?: string | null
          label?: string | null
          strength?: number
          created_at?: string
        }
      }
      reels: {
        Row: {
          id: string
          study_id: string
          workspace_id: string
          position: number
          track: string
          track_index: number
          title: string
          scenes: Json
          finding_ids: Json
          source_names: Json
          warning: string | null
          enabled: boolean
          footage: Json | null
          art: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          study_id: string
          workspace_id: string
          position: number
          track: string
          track_index: number
          title: string
          scenes: Json
          finding_ids?: Json
          source_names?: Json
          warning?: string | null
          enabled?: boolean
          footage?: Json | null
          art?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          study_id?: string
          workspace_id?: string
          position?: number
          track?: string
          track_index?: number
          title?: string
          scenes?: Json
          finding_ids?: Json
          source_names?: Json
          warning?: string | null
          enabled?: boolean
          footage?: Json | null
          art?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      footage_clips: {
        Row: {
          id: string
          workspace_id: string
          storage_id: string
          url: string
          name: string
          size: number
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          storage_id: string
          url: string
          name: string
          size: number
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          storage_id?: string
          url?: string
          name?: string
          size?: number
          uploaded_by?: string
          created_at?: string
        }
      }
      generation_jobs: {
        Row: {
          id: string
          study_id: string
          workspace_id: string
          status: 'pending' | 'running' | 'done' | 'failed'
          phase: 'extracting' | 'composing' | 'done'
          cursor: number
          chunks: Json
          attempts: number
          log: Json
          locked_until: string
          error: string | null
          error_detail: string | null
          started_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          study_id: string
          workspace_id: string
          status: 'pending' | 'running' | 'done' | 'failed'
          phase: 'extracting' | 'composing' | 'done'
          cursor?: number
          chunks?: Json
          attempts?: number
          log?: Json
          locked_until: string
          error?: string | null
          error_detail?: string | null
          started_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          study_id?: string
          workspace_id?: string
          status?: 'pending' | 'running' | 'done' | 'failed'
          phase?: 'extracting' | 'composing' | 'done'
          cursor?: number
          chunks?: Json
          attempts?: number
          log?: Json
          locked_until?: string
          error?: string | null
          error_detail?: string | null
          started_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      reactions: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          user_id: string
          kind: 'true' | 'surprised' | 'pushback'
          created_at: string
        }
        Insert: {
          id?: string
          reel_id: string
          study_id: string
          user_id: string
          kind: 'true' | 'surprised' | 'pushback'
          created_at?: string
        }
        Update: {
          id?: string
          reel_id?: string
          study_id?: string
          user_id?: string
          kind?: 'true' | 'surprised' | 'pushback'
          created_at?: string
        }
      }
      share_links: {
        Row: {
          id: string
          study_id: string
          workspace_id: string
          token: string
          created_by: string
          revoked: boolean
          hide_team_comments: boolean
          created_at: string
        }
        Insert: {
          id?: string
          study_id: string
          workspace_id: string
          token: string
          created_by: string
          revoked?: boolean
          hide_team_comments?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          study_id?: string
          workspace_id?: string
          token?: string
          created_by?: string
          revoked?: boolean
          hide_team_comments?: boolean
          created_at?: string
        }
      }
      guests: {
        Row: {
          id: string
          study_id: string
          link_id: string
          name: string
          secret: string
          created_at: string
        }
        Insert: {
          id?: string
          study_id: string
          link_id: string
          name: string
          secret: string
          created_at?: string
        }
        Update: {
          id?: string
          study_id?: string
          link_id?: string
          name?: string
          secret?: string
          created_at?: string
        }
      }
      guest_reactions: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          guest_id: string
          kind: 'true' | 'surprised' | 'pushback'
          created_at: string
        }
        Insert: {
          id?: string
          reel_id: string
          study_id: string
          guest_id: string
          kind: 'true' | 'surprised' | 'pushback'
          created_at?: string
        }
        Update: {
          id?: string
          reel_id?: string
          study_id?: string
          guest_id?: string
          kind?: 'true' | 'surprised' | 'pushback'
          created_at?: string
        }
      }
      guest_views: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          guest_id: string
          view_count: number
          completed: boolean
          last_viewed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reel_id: string
          study_id: string
          guest_id: string
          view_count?: number
          completed?: boolean
          last_viewed_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reel_id?: string
          study_id?: string
          guest_id?: string
          view_count?: number
          completed?: boolean
          last_viewed_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          user_id: string | null
          guest_id: string | null
          parent_id: string | null
          kind: 'comment' | 'reply'
          body: string
          resolved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reel_id: string
          study_id: string
          user_id?: string | null
          guest_id?: string | null
          parent_id?: string | null
          kind: 'comment' | 'reply'
          body: string
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reel_id?: string
          study_id?: string
          user_id?: string | null
          guest_id?: string | null
          parent_id?: string | null
          kind?: 'comment' | 'reply'
          body?: string
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      reel_views: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          user_id: string
          view_count: number
          completed: boolean
          last_viewed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reel_id: string
          study_id: string
          user_id: string
          view_count?: number
          completed?: boolean
          last_viewed_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reel_id?: string
          study_id?: string
          user_id?: string
          view_count?: number
          completed?: boolean
          last_viewed_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      saved_reels: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          reel_id: string
          study_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          reel_id: string
          study_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          reel_id?: string
          study_id?: string
          created_at?: string
        }
      }
      reel_counters: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          true_count: number
          surprised_count: number
          pushback_count: number
          comment_count: number
          open_count: number
          guest_comment_count: number
          guest_open_count: number
          views: number
          viewers: number
          completions: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reel_id: string
          study_id: string
          true_count?: number
          surprised_count?: number
          pushback_count?: number
          comment_count?: number
          open_count?: number
          guest_comment_count?: number
          guest_open_count?: number
          views?: number
          viewers?: number
          completions?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reel_id?: string
          study_id?: string
          true_count?: number
          surprised_count?: number
          pushback_count?: number
          comment_count?: number
          open_count?: number
          guest_comment_count?: number
          guest_open_count?: number
          views?: number
          viewers?: number
          completions?: number
          created_at?: string
          updated_at?: string
        }
      }
      decks: {
        Row: {
          id: string
          workspace_id: string
          scope: string
          scope_label: string
          created_by: string
          slides: Json
          stats: Json
          reels: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          scope: string
          scope_label: string
          created_by: string
          slides?: Json
          stats: Json
          reels?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          scope?: string
          scope_label?: string
          created_by?: string
          slides?: Json
          stats?: Json
          reels?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_member: {
        Args: { workspace_uuid: string }
        Returns: boolean
      }
      get_workspace_role: {
        Args: { workspace_uuid: string }
        Returns: string
      }
      can_edit_workspace: {
        Args: { workspace_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
