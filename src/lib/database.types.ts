// Complete database types - expand the stub
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
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['workspaces']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
        }
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>
      }
      studies: {
        Row: {
          id: string
          workspace_id: string
          title: string
          audience: string
          goal: string | null
          status: 'draft' | 'processing' | 'published' | 'failed' | 'archived'
          tracks: Json
          created_by: string
          published_at: string | null
          last_error: string | null
          is_demo: boolean
          deleting: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['studies']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          is_demo?: boolean
          deleting?: boolean
        }
        Update: Partial<Database['public']['Tables']['studies']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['reels']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
        }
        Update: Partial<Database['public']['Tables']['reels']['Insert']>
      }
      // Add more as needed...
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
