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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      capital_events: {
        Row: {
          amount: number
          created_at: string
          event_date: string
          event_type: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_date?: string
          event_type: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_responses: {
        Row: {
          created_at: string
          id: string
          items: Json
          log_date: string
          notes: string | null
          readiness_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          log_date?: string
          notes?: string | null
          readiness_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          log_date?: string
          notes?: string | null
          readiness_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_journals: {
        Row: {
          created_at: string
          energy: number | null
          focus: number | null
          id: string
          journal_date: string
          lessons: string | null
          market_view: string | null
          mood: number | null
          post_market_notes: string | null
          pre_market_notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number | null
          focus?: number | null
          id?: string
          journal_date?: string
          lessons?: string | null
          market_view?: string | null
          mood?: number | null
          post_market_notes?: string | null
          pre_market_notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number | null
          focus?: number | null
          id?: string
          journal_date?: string
          lessons?: string | null
          market_view?: string | null
          mood?: number | null
          post_market_notes?: string | null
          pre_market_notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reviews: {
        Row: {
          created_at: string
          did_well: string | null
          emotionally_disciplined: boolean | null
          followed_plan: boolean | null
          id: string
          improve_tomorrow: string | null
          mistakes: string | null
          review_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          did_well?: string | null
          emotionally_disciplined?: boolean | null
          followed_plan?: boolean | null
          id?: string
          improve_tomorrow?: string | null
          mistakes?: string | null
          review_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          did_well?: string | null
          emotionally_disciplined?: boolean | null
          followed_plan?: boolean | null
          id?: string
          improve_tomorrow?: string | null
          mistakes?: string | null
          review_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discipline_logs: {
        Row: {
          created_at: string
          followed: boolean
          id: string
          log_date: string
          notes: string | null
          rule: string
          trade_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          followed?: boolean
          id?: string
          log_date?: string
          notes?: string | null
          rule: string
          trade_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          followed?: boolean
          id?: string
          log_date?: string
          notes?: string | null
          rule?: string
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_logs_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          route_at_time: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          route_at_time?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          route_at_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          rules: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rules?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rules?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          base_capital: number | null
          broker: string | null
          created_at: string
          currency: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_capital?: number | null
          broker?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_capital?: number | null
          broker?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      process_quality_logs: {
        Row: {
          checklist_score: number | null
          consistency_score: number | null
          created_at: string
          discipline_score: number | null
          emotional_score: number | null
          id: string
          journaling_score: number | null
          log_date: string
          total_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_score?: number | null
          consistency_score?: number | null
          created_at?: string
          discipline_score?: number | null
          emotional_score?: number | null
          id?: string
          journaling_score?: number | null
          log_date?: string
          total_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_score?: number | null
          consistency_score?: number | null
          created_at?: string
          discipline_score?: number | null
          emotional_score?: number | null
          id?: string
          journaling_score?: number | null
          log_date?: string
          total_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          experience_level: string | null
          id: string
          timezone: string | null
          trading_style: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          id: string
          timezone?: string | null
          trading_style?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          experience_level?: string | null
          id?: string
          timezone?: string | null
          trading_style?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_notes: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          note_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          note_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          note_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_exits: {
        Row: {
          created_at: string
          exit_date: string
          exit_price: number
          fees: number | null
          id: string
          notes: string | null
          quantity: number
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exit_date?: string
          exit_price: number
          fees?: number | null
          id?: string
          notes?: string | null
          quantity: number
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          exit_date?: string
          exit_price?: number
          fees?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_exits_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          brokerage: number
          confidence: number | null
          created_at: string
          discipline_feel: number | null
          emotion_level: number | null
          emotion_tags: string[] | null
          entry_date: string
          entry_price: number
          entry_time: string | null
          external_ref: string | null
          id: string
          instrument_type: string
          lessons_learned: string | null
          notes: string | null
          other_fees: number
          planned_entry: number | null
          planned_stop_loss: number | null
          planned_target: number | null
          playbook_id: string | null
          portfolio_id: string | null
          quantity: number
          recovery_urge: number | null
          review_notes: string | null
          screenshot_url: string | null
          setup: string | null
          setup_match: number | null
          side: string
          source: string
          status: string
          stop_loss: number | null
          strategy: string | null
          symbol: string
          tags: string[]
          target_price: number | null
          taxes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brokerage?: number
          confidence?: number | null
          created_at?: string
          discipline_feel?: number | null
          emotion_level?: number | null
          emotion_tags?: string[] | null
          entry_date?: string
          entry_price: number
          entry_time?: string | null
          external_ref?: string | null
          id?: string
          instrument_type?: string
          lessons_learned?: string | null
          notes?: string | null
          other_fees?: number
          planned_entry?: number | null
          planned_stop_loss?: number | null
          planned_target?: number | null
          playbook_id?: string | null
          portfolio_id?: string | null
          quantity: number
          recovery_urge?: number | null
          review_notes?: string | null
          screenshot_url?: string | null
          setup?: string | null
          setup_match?: number | null
          side?: string
          source?: string
          status?: string
          stop_loss?: number | null
          strategy?: string | null
          symbol: string
          tags?: string[]
          target_price?: number | null
          taxes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brokerage?: number
          confidence?: number | null
          created_at?: string
          discipline_feel?: number | null
          emotion_level?: number | null
          emotion_tags?: string[] | null
          entry_date?: string
          entry_price?: number
          entry_time?: string | null
          external_ref?: string | null
          id?: string
          instrument_type?: string
          lessons_learned?: string | null
          notes?: string | null
          other_fees?: number
          planned_entry?: number | null
          planned_stop_loss?: number | null
          planned_target?: number | null
          playbook_id?: string | null
          portfolio_id?: string | null
          quantity?: number
          recovery_urge?: number | null
          review_notes?: string | null
          screenshot_url?: string | null
          setup?: string | null
          setup_match?: number | null
          side?: string
          source?: string
          status?: string
          stop_loss?: number | null
          strategy?: string | null
          symbol?: string
          tags?: string[]
          target_price?: number | null
          taxes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          best_setups: string | null
          created_at: string
          id: string
          most_broken_rules: string | null
          summary: string | null
          updated_at: string
          user_id: string
          week_start: string
          worst_setups: string | null
        }
        Insert: {
          best_setups?: string | null
          created_at?: string
          id?: string
          most_broken_rules?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
          week_start: string
          worst_setups?: string | null
        }
        Update: {
          best_setups?: string | null
          created_at?: string
          id?: string
          most_broken_rules?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
          worst_setups?: string | null
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
