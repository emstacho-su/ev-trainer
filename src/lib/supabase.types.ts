export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_stats: {
        Row: {
          avg_ev_loss: number
          correct_decisions: number
          date: string
          id: string
          sessions_completed: number
          total_decisions: number
          user_id: string
        }
        Insert: {
          avg_ev_loss?: number
          correct_decisions?: number
          date: string
          id?: string
          sessions_completed?: number
          total_decisions?: number
          user_id: string
        }
        Update: {
          avg_ev_loss?: number
          correct_decisions?: number
          date?: string
          id?: string
          sessions_completed?: number
          total_decisions?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          subscription_tier: string
          trainer_preferences: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          subscription_tier?: string
          trainer_preferences?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          subscription_tier?: string
          trainer_preferences?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      session_entries: {
        Row: {
          action_id: string
          created_at: string
          id: string
          index: number
          is_flagged: boolean
          result: Json | null
          session_id: string
          spot: Json
          spot_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          index: number
          is_flagged?: boolean
          result?: Json | null
          session_id: string
          spot: Json
          spot_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          index?: number
          is_flagged?: boolean
          result?: Json | null
          session_id?: string
          spot?: Json
          spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_stats: {
        Row: {
          avg_ev_loss: number
          correct_decisions: number
          hero_position: string
          id: string
          last_practiced: string
          spot_id: string
          street: string
          total_decisions: number
          updated_at: string
          user_id: string
          villain_position: string | null
        }
        Insert: {
          avg_ev_loss?: number
          correct_decisions?: number
          hero_position: string
          id?: string
          last_practiced: string
          spot_id: string
          street: string
          total_decisions?: number
          updated_at?: string
          user_id: string
          villain_position?: string | null
        }
        Update: {
          avg_ev_loss?: number
          correct_decisions?: number
          hero_position?: string
          id?: string
          last_practiced?: string
          spot_id?: string
          street?: string
          total_decisions?: number
          updated_at?: string
          user_id?: string
          villain_position?: string | null
        }
        Relationships: []
      }
      spots: {
        Row: {
          board: string[]
          created_at: string
          created_by: string | null
          difficulty_rating: number | null
          effective_stack_bb: number
          hero_hand: string[] | null
          hero_position: string
          hero_to_act: string
          history: string[]
          id: string
          is_system: boolean
          positions: string[]
          pot_bb: number
          pot_type: string
          scenario_type: string | null
          share_code: string | null
          spot_id: string
          stacks_bb: Json
          street: string
          tags: string[]
          updated_at: string
          villain_position: string | null
        }
        Insert: {
          board?: string[]
          created_at?: string
          created_by?: string | null
          difficulty_rating?: number | null
          effective_stack_bb: number
          hero_hand?: string[] | null
          hero_position: string
          hero_to_act: string
          history?: string[]
          id?: string
          is_system?: boolean
          positions: string[]
          pot_bb: number
          pot_type: string
          scenario_type?: string | null
          share_code?: string | null
          spot_id: string
          stacks_bb: Json
          street: string
          tags?: string[]
          updated_at?: string
          villain_position?: string | null
        }
        Update: {
          board?: string[]
          created_at?: string
          created_by?: string | null
          difficulty_rating?: number | null
          effective_stack_bb?: number
          hero_hand?: string[] | null
          hero_position?: string
          hero_to_act?: string
          history?: string[]
          id?: string
          is_system?: boolean
          positions?: string[]
          pot_bb?: number
          pot_type?: string
          scenario_type?: string | null
          share_code?: string | null
          spot_id?: string
          stacks_bb?: Json
          street?: string
          tags?: string[]
          updated_at?: string
          villain_position?: string | null
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          created_at: string
          current_spot: Json | null
          decision_index: number
          decisions_per_session: number
          filters: Json
          id: string
          is_complete: boolean
          mode: string
          seed: string
          session_id: string
          target_stack_bb: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_spot?: Json | null
          decision_index?: number
          decisions_per_session?: number
          filters?: Json
          id?: string
          is_complete?: boolean
          mode: string
          seed: string
          session_id: string
          target_stack_bb?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_spot?: Json | null
          decision_index?: number
          decisions_per_session?: number
          filters?: Json
          id?: string
          is_complete?: boolean
          mode?: string
          seed?: string
          session_id?: string
          target_stack_bb?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
