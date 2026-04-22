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
      customers: {
        Row: {
          account_id: string | null
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          credit_limit: number
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      inventory_permit_lines: {
        Row: {
          id: string
          item_id: string
          line_order: number
          line_total: number
          notes: string | null
          permit_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          line_order?: number
          line_total?: number
          notes?: string | null
          permit_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string
          line_order?: number
          line_total?: number
          notes?: string | null
          permit_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_permit_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_permit_lines_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "inventory_permits"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_permits: {
        Row: {
          counterparty_account_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          permit_date: string
          permit_number: string
          permit_type: Database["public"]["Enums"]["permit_type"]
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["permit_status"]
          supplier_id: string | null
          total_amount: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          counterparty_account_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          permit_date?: string
          permit_number: string
          permit_type: Database["public"]["Enums"]["permit_type"]
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          counterparty_account_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          permit_date?: string
          permit_number?: string
          permit_type?: Database["public"]["Enums"]["permit_type"]
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_permits_counterparty_account_id_fkey"
            columns: ["counterparty_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_permits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_permits_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_permits_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_permits_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
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
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          item_id: string
          line_order: number
          line_total: number
          notes: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id: string
          item_id: string
          line_order?: number
          line_total?: number
          notes?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          item_id?: string
          line_order?: number
          line_total?: number
          notes?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_request_lines: {
        Row: {
          id: string
          item_id: string
          line_order: number
          line_total: number
          notes: string | null
          quantity: number
          request_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          line_order?: number
          line_total?: number
          notes?: string | null
          quantity?: number
          request_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string
          line_order?: number
          line_total?: number
          notes?: string | null
          quantity?: number
          request_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_requests: {
        Row: {
          counterparty_account_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number
          id: string
          invoice_id: string | null
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes: string | null
          permit_id: string | null
          request_date: string
          request_number: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["invoice_request_status"]
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_percent: number
          total_amount: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          counterparty_account_id: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          permit_id?: string | null
          request_date?: string
          request_number: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["invoice_request_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          counterparty_account_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          permit_id?: string | null
          request_date?: string
          request_number?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["invoice_request_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_requests_counterparty_account_id_fkey"
            columns: ["counterparty_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "inventory_permits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          counterparty_account_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          journal_entry_id: string | null
          notes: string | null
          permit_id: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_percent: number
          total_amount: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          counterparty_account_id: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          journal_entry_id?: string | null
          notes?: string | null
          permit_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          counterparty_account_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          journal_entry_id?: string | null
          notes?: string | null
          permit_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_counterparty_account_id_fkey"
            columns: ["counterparty_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "inventory_permits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      item_stock: {
        Row: {
          id: string
          item_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          item_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          item_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          account_id: string | null
          category_id: string | null
          code: string
          cost_price: number
          created_at: string
          created_by: string | null
          default_warehouse_id: string | null
          description: string | null
          id: string
          is_active: boolean
          min_stock: number
          name: string
          sale_price: number
          unit: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          code: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          default_warehouse_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          sale_price?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          code?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          default_warehouse_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          sale_price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
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
          customer_id: string | null
          debit: number
          description: string | null
          entry_id: string
          exchange_rate: number
          id: string
          line_order: number
          supplier_id: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          currency_code?: string
          customer_id?: string | null
          debit?: number
          description?: string | null
          entry_id: string
          exchange_rate?: number
          id?: string
          line_order?: number
          supplier_id?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          currency_code?: string
          customer_id?: string | null
          debit?: number
          description?: string | null
          entry_id?: string
          exchange_rate?: number
          id?: string
          line_order?: number
          supplier_id?: string | null
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
            foreignKeyName: "journal_entry_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          item_id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          permit_id: string | null
          quantity: number
          unit_price: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          item_id: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          permit_id?: string | null
          quantity: number
          unit_price?: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          item_id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          permit_id?: string | null
          quantity?: number
          unit_price?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "inventory_permits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_id: string | null
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          credit_limit: number
          currency: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
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
      warehouses: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_inventory_permit: {
        Args: { _permit_id: string; _review_notes?: string }
        Returns: string
      }
      confirm_invoice_request: {
        Args: {
          _discount_amount?: number
          _notes?: string
          _request_id: string
          _tax_percent?: number
        }
        Returns: string
      }
      create_invoice_request_from_permit: {
        Args: {
          _discount_amount?: number
          _line_prices?: Json
          _notes?: string
          _permit_id: string
          _tax_percent?: number
        }
        Returns: string
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_inventory_permit: {
        Args: { _permit_id: string; _review_notes?: string }
        Returns: undefined
      }
      hold_invoice_request: {
        Args: { _request_id: string; _review_notes?: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      reject_inventory_permit: {
        Args: { _permit_id: string; _review_notes?: string }
        Returns: undefined
      }
      reject_invoice_request: {
        Args: { _request_id: string; _review_notes?: string }
        Returns: undefined
      }
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
        | "customers.view"
        | "customers.create"
        | "customers.edit"
        | "customers.delete"
        | "suppliers.view"
        | "suppliers.create"
        | "suppliers.edit"
        | "suppliers.delete"
        | "inventory.view"
        | "inventory.manage"
        | "inventory.request"
        | "inventory.approve"
        | "invoices.view"
        | "invoices.manage"
        | "invoices.approve"
      custody_status: "active" | "settled" | "cancelled"
      inventory_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "fulfilled"
      invoice_request_status: "pending" | "confirmed" | "rejected" | "on_hold"
      invoice_status: "confirmed" | "cancelled"
      invoice_type: "sale" | "purchase" | "sale_return" | "purchase_return"
      journal_status: "posted"
      movement_type: "in" | "out" | "adjust" | "transfer"
      permit_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "on_hold"
        | "invoiced"
      permit_type: "issue" | "receive" | "sales_return" | "purchase_return"
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
        "customers.view",
        "customers.create",
        "customers.edit",
        "customers.delete",
        "suppliers.view",
        "suppliers.create",
        "suppliers.edit",
        "suppliers.delete",
        "inventory.view",
        "inventory.manage",
        "inventory.request",
        "inventory.approve",
        "invoices.view",
        "invoices.manage",
        "invoices.approve",
      ],
      custody_status: ["active", "settled", "cancelled"],
      inventory_request_status: [
        "pending",
        "approved",
        "rejected",
        "fulfilled",
      ],
      invoice_request_status: ["pending", "confirmed", "rejected", "on_hold"],
      invoice_status: ["confirmed", "cancelled"],
      invoice_type: ["sale", "purchase", "sale_return", "purchase_return"],
      journal_status: ["posted"],
      movement_type: ["in", "out", "adjust", "transfer"],
      permit_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "on_hold",
        "invoiced",
      ],
      permit_type: ["issue", "receive", "sales_return", "purchase_return"],
    },
  },
} as const
