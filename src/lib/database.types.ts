export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      analytics_events: {
        Row: {
          id: string
          created_at: string
          event: string
          user_id: string | null
          workspace_id: string | null
          anonymous_id: string | null
          session_id: string | null
          path: string | null
          properties: Json
        }
        Insert: {
          id?: string
          created_at?: string
          event: string
          user_id?: string | null
          workspace_id?: string | null
          anonymous_id?: string | null
          session_id?: string | null
          path?: string | null
          properties?: Json
        }
        Update: {
          id?: string
          created_at?: string
          event?: string
          user_id?: string | null
          workspace_id?: string | null
          anonymous_id?: string | null
          session_id?: string | null
          path?: string | null
          properties?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      comments: {
        Row: {
          id: string
          reel_id: string
          study_id: string
          user_id: string | null
          guest_id: string | null
          parent_id: string | null
          kind: 'note' | 'question' | 'action'
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
          kind: 'note' | 'question' | 'action'
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
          kind?: 'note' | 'question' | 'action'
          body?: string
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "decks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "email_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_prefs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "findings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "footage_clips_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "footage_clips_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      generation_jobs: {
        Row: {
          id: string
          study_id: string
          workspace_id: string
          status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
          phase: 'extract' | 'compose' | 'verify' | 'done'
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
          status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
          phase: 'extract' | 'compose' | 'verify' | 'done'
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
          status?: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
          phase?: 'extract' | 'compose' | 'verify' | 'done'
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
        Relationships: [
          {
            foreignKeyName: "generation_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "guest_reactions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_reactions_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_reactions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          }
        ]
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
          counted_on: string | null
          last_session_id: string | null
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
          counted_on?: string | null
          last_session_id?: string | null
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
          counted_on?: string | null
          last_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_views_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_views_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_views_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "guests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "reactions_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "reel_counters_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: true
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_counters_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          }
        ]
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
          counted_on: string | null
          last_session_id: string | null
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
          counted_on?: string | null
          last_session_id?: string | null
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
          counted_on?: string | null
          last_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_views_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_views_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
          topics: string[]
          source_names: Json
          warning: string | null
          enabled: boolean
          footage: Json | null
          art: Json | null
          video: Json | null
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
          topics?: string[]
          source_names?: Json
          warning?: string | null
          enabled?: boolean
          footage?: Json | null
          art?: Json | null
          video?: Json | null
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
          topics?: string[]
          source_names?: Json
          warning?: string | null
          enabled?: boolean
          footage?: Json | null
          art?: Json | null
          video?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "saved_reels_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reels_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "sources_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "studies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "upload_claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      ad_spend: {
        Row: {
          id: string
          created_at: string
          created_by: string | null
          period_start: string
          period_end: string
          source: string
          medium: string | null
          campaign: string
          amount_cents: number
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          created_by?: string | null
          period_start: string
          period_end: string
          source: string
          medium?: string | null
          campaign: string
          amount_cents: number
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          created_by?: string | null
          period_start?: string
          period_end?: string
          source?: string
          medium?: string | null
          campaign?: string
          amount_cents?: number
          note?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          token_identifier: string
          name: string | null
          email: string | null
          avatar: string | null
          onboarded_at: string | null
          trial_used_at: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          utm_term: string | null
          utm_content: string | null
          signup_referrer: string | null
          landing_path: string | null
          click_id: string | null
          click_id_type: string | null
          is_admin: boolean
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
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_term?: string | null
          utm_content?: string | null
          signup_referrer?: string | null
          landing_path?: string | null
          click_id?: string | null
          click_id_type?: string | null
          is_admin?: boolean
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
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_term?: string | null
          utm_content?: string | null
          signup_referrer?: string | null
          landing_path?: string | null
          click_id?: string | null
          click_id_type?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "workspace_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "workspace_removals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_removals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "workspaces_checkout_by_fkey"
            columns: ["checkout_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_workspace: {
        Args: {
          workspace_uuid: string
        }
        Returns: boolean
      }
      get_workspace_role: {
        Args: {
          workspace_uuid: string
        }
        Returns: string
      }
      is_workspace_member: {
        Args: {
          workspace_uuid: string
        }
        Returns: boolean
      }
      record_reel_view: {
        Args: {
          p_reel_id: string
          p_completed?: boolean
          p_session_id?: string | null
        }
        Returns: Json
      }
      record_guest_reel_view: {
        Args: {
          p_reel_id: string
          p_completed?: boolean
          p_token?: string | null
          p_secret?: string | null
          p_session_id?: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
      PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
      PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never
