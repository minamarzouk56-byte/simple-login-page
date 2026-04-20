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
      accounts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          exchange_rate: number
          id: string
          is_active: boolean
          level: number
          name: string
          opening_balance: number
          opening_balance_credit: number
          opening_balance_debit: number
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean
          level?: number
          name: string
          opening_balance?: number
          opening_balance_credit?: number
          opening_balance_debit?: number
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          opening_balance?: number
          opening_balance_credit?: number
          opening_balance_debit?: number
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      action_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          exchange_rate: number
          is_base: boolean
          name_ar: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          exchange_rate?: number
          is_base?: boolean
          name_ar: string
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          exchange_rate?: number
          is_base?: boolean
          name_ar?: string
          symbol?: string
        }
        Relationships: []
      }
      custodies: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency_code: string
          custody_number: string
          holder_id: string
          id: string
          issued_at: string
          notes: string | null
          purpose: string | null
          settled_amount: number | null
          settled_at: string | null
          status: Database["public"]["Enums"]["custody_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custody_number: string
          holder_id: string
          id?: string
          issued_at?: string
          notes?: string | null
          purpose?: string | null
          settled_amount?: number | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["custody_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custody_number?: string
          holder_id?: string
          id?: string
          issued_at?: string
          notes?: string | null
          purpose?: string | null
          settled_amount?: number | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["custody_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodies_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      inventory_requests: {
        Row: {
          created_at: string
          id: string
          item_name: string
          quantity: number
          reason: string | null
          request_number: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["inventory_request_status"]
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          quantity?: number
          reason?: string | null
          request_number: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["inventory_request_status"]
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          quantity?: number
          reason?: string | null
          request_number?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["inventory_request_status"]
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          reference: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          entry_date?: string
          entry_number: string
          id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          credit: number
          currency_code: string
          debit: number
          description: string | null
          entry_id: string
          exchange_rate: number
          id: string
          line_order: number
          partner_id: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          currency_code?: string
          debit?: number
          description?: string | null
          entry_id: string
          exchange_rate?: number
          id?: string
          line_order?: number
          partner_id?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          currency_code?: string
          debit?: number
          description?: string | null
          entry_id?: string
          exchange_rate?: number
          id?: string
          line_order?: number
          partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name_ar: string
          notes: string | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          phone: string | null
          tax_number: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          notes?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          tax_number?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          notes?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          tax_number?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          force_password_change: boolean
          full_name: string | null
          id: string
          is_admin: boolean
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          force_password_change?: boolean
          full_name?: string | null
          id?: string
          is_admin?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          force_password_change?: boolean
          full_name?: string | null
          id?: string
          is_admin?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_permission:
        | "accounts.view"
        | "accounts.create"
        | "accounts.edit"
        | "accounts.delete"
        | "journal.view"
        | "journal.create"
        | "journal.edit"
        | "journal.delete"
        | "partners.view"
        | "partners.create"
        | "partners.edit"
        | "partners.delete"
        | "reports.view"
        | "users.manage"
        | "settings.manage"
        | "dashboard.view"
      custody_status: "active" | "settled" | "cancelled"
      inventory_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "fulfilled"
      journal_status: "posted"
      partner_type: "customer" | "supplier" | "both"
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
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_permission: [
        "accounts.view",
        "accounts.create",
        "accounts.edit",
        "accounts.delete",
        "journal.view",
        "journal.create",
        "journal.edit",
        "journal.delete",
        "partners.view",
        "partners.create",
        "partners.edit",
        "partners.delete",
        "reports.view",
        "users.manage",
        "settings.manage",
        "dashboard.view",
      ],
      custody_status: ["active", "settled", "cancelled"],
      inventory_request_status: [
        "pending",
        "approved",
        "rejected",
        "fulfilled",
      ],
      journal_status: ["posted"],
      partner_type: ["customer", "supplier", "both"],
    },
  },
} as const
