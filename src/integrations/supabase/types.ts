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
      client_portal_tokens: {
        Row: {
          created_at: string
          diary_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          lawyer_id: string
          token: string
        }
        Insert: {
          created_at?: string
          diary_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          lawyer_id: string
          token?: string
        }
        Update: {
          created_at?: string
          diary_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          lawyer_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_tokens_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_tokens_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diaries: {
        Row: {
          case_number: string
          case_type: string
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          cnr_last_synced_at: string | null
          cnr_number: string | null
          cnr_sync_enabled: boolean
          court_name: string
          court_number: string | null
          created_at: string
          firm_id: string | null
          hearing_time: string | null
          id: string
          judge_name: string | null
          lawyer_id: string
          matter_date: string
          notes: string | null
          opponent_advocate: string | null
          party_names: string
          purpose_of_hearing: string | null
          reminder_enabled: boolean
          reminder_hours_before: number
          reminder_sent_at: string | null
          stage_of_case: string | null
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
        }
        Insert: {
          case_number: string
          case_type: string
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          cnr_last_synced_at?: string | null
          cnr_number?: string | null
          cnr_sync_enabled?: boolean
          court_name: string
          court_number?: string | null
          created_at?: string
          firm_id?: string | null
          hearing_time?: string | null
          id?: string
          judge_name?: string | null
          lawyer_id: string
          matter_date: string
          notes?: string | null
          opponent_advocate?: string | null
          party_names: string
          purpose_of_hearing?: string | null
          reminder_enabled?: boolean
          reminder_hours_before?: number
          reminder_sent_at?: string | null
          stage_of_case?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Update: {
          case_number?: string
          case_type?: string
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          cnr_last_synced_at?: string | null
          cnr_number?: string | null
          cnr_sync_enabled?: boolean
          court_name?: string
          court_number?: string | null
          created_at?: string
          firm_id?: string | null
          hearing_time?: string | null
          id?: string
          judge_name?: string | null
          lawyer_id?: string
          matter_date?: string
          notes?: string | null
          opponent_advocate?: string | null
          party_names?: string
          purpose_of_hearing?: string | null
          reminder_enabled?: boolean
          reminder_hours_before?: number
          reminder_sent_at?: string | null
          stage_of_case?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diaries_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_shares: {
        Row: {
          can_edit: boolean
          created_at: string
          diary_id: string
          granted_by: string
          id: string
          partner_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          diary_id: string
          granted_by: string
          id?: string
          partner_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          diary_id?: string
          granted_by?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_shares_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_timeline_entries: {
        Row: {
          content: string
          created_at: string
          created_by: string
          diary_id: string
          entry_date: string
          entry_type: string | null
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          diary_id: string
          entry_date?: string
          entry_type?: string | null
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          diary_id?: string
          entry_date?: string
          entry_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_timeline_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          diary_id: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          ocr_text: string | null
          owner_id: string
          storage_key: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          diary_id?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_text?: string | null
          owner_id: string
          storage_key: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          diary_id?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_text?: string | null
          owner_id?: string
          storage_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          created_at: string
          diary_id: string
          id: string
          lawyer_id: string
          mode: string
          note: string | null
          payment_date: string
          payment_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          diary_id: string
          id?: string
          lawyer_id: string
          mode?: string
          note?: string | null
          payment_date?: string
          payment_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          diary_id?: string
          id?: string
          lawyer_id?: string
          mode?: string
          note?: string | null
          payment_date?: string
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_invites: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          id: string
          invited_by: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          id?: string
          invited_by: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          id?: string
          invited_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_invites_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          brand_logo_url: string | null
          brand_primary_color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          description: string
          diary_id: string | null
          due_date: string | null
          gst_amount: number | null
          gst_applicable: boolean
          gst_rate: number
          id: string
          invoice_number: string
          issue_date: string
          lawyer_id: string
          notes: string | null
          paid_at: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          description: string
          diary_id?: string | null
          due_date?: string | null
          gst_amount?: number | null
          gst_applicable?: boolean
          gst_rate?: number
          id?: string
          invoice_number: string
          issue_date?: string
          lawyer_id: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          description?: string
          diary_id?: string | null
          due_date?: string | null
          gst_amount?: number | null
          gst_applicable?: boolean
          gst_rate?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          lawyer_id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_private_details: {
        Row: {
          created_at: string
          enrollment_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enrollment_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          reminder_hours: number[]
          sms_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          reminder_hours?: number[]
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          reminder_hours?: number[]
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      partner_relationships: {
        Row: {
          created_at: string
          id: string
          lawyer_id: string
          message: string | null
          partner_id: string
          requested_by: string
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lawyer_id: string
          message?: string | null
          partner_id: string
          requested_by: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lawyer_id?: string
          message?: string | null
          partner_id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          court_name: string | null
          created_at: string
          description: string | null
          email: string
          experience_years: number | null
          fcm_token: string | null
          firm_id: string | null
          firm_logo_url: string | null
          id: string
          name: string
          phone: string | null
          practice_area: string | null
          profile_photo_url: string | null
          role: Database["public"]["Enums"]["app_role"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          court_name?: string | null
          created_at?: string
          description?: string | null
          email?: string
          experience_years?: number | null
          fcm_token?: string | null
          firm_id?: string | null
          firm_logo_url?: string | null
          id: string
          name?: string
          phone?: string | null
          practice_area?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          court_name?: string | null
          created_at?: string
          description?: string | null
          email?: string
          experience_years?: number | null
          fcm_token?: string | null
          firm_id?: string | null
          firm_logo_url?: string | null
          id?: string
          name?: string
          phone?: string | null
          practice_area?: string | null
          profile_photo_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          razorpay_plan_id: string | null
          razorpay_subscription_id: string | null
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_id: string }; Returns: undefined }
      can_edit_diary: {
        Args: { _diary_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_diary: {
        Args: { _diary_id: string; _user_id: string }
        Returns: boolean
      }
      get_portal_case: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_diary: {
        Args: { _diary_id: string; _user_id: string }
        Returns: boolean
      }
      remove_member: { Args: { member_id: string }; Returns: undefined }
      search_directory: {
        Args: {
          _query: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          city: string
          court_name: string
          description: string
          experience_years: number
          id: string
          name: string
          practice_area: string
          profile_photo_url: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
    }
    Enums: {
      app_role: "lawyer" | "partner" | "admin"
      case_status: "active" | "disposed" | "appealed" | "adjourned"
      document_category:
        | "client_evidence"
        | "filed_plaints"
        | "research_notes"
        | "case_law_citations"
      relationship_status: "pending" | "accepted" | "rejected" | "removed"
      subscription_tier: "free" | "pro" | "chambers" | "firm"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["lawyer", "partner", "admin"],
      case_status: ["active", "disposed", "appealed", "adjourned"],
      document_category: [
        "client_evidence",
        "filed_plaints",
        "research_notes",
        "case_law_citations",
      ],
      relationship_status: ["pending", "accepted", "rejected", "removed"],
      subscription_tier: ["free", "pro", "chambers", "firm"],
    },
  },
} as const
