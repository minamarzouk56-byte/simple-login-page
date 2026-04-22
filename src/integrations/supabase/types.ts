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
      batches: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          display_code: string | null
          id: string
          product_id: string
          quantity: number
          remaining_quantity: number
          source_order_id: string | null
          supplier_id: string | null
          unit_cost: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          display_code?: string | null
          id?: string
          product_id: string
          quantity?: number
          remaining_quantity?: number
          source_order_id?: string | null
          supplier_id?: string | null
          unit_cost?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          display_code?: string | null
          id?: string
          product_id?: string
          quantity?: number
          remaining_quantity?: number
          source_order_id?: string | null
          supplier_id?: string | null
          unit_cost?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
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
      items: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          created_by: string | null
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
          category_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
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
          category_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
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
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
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
      order_line_batches: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          order_line_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          order_line_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          order_line_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_line_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_batches_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          allocated_quantity: number
          id: string
          line_order: number
          line_total: number
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          allocated_quantity?: number
          id?: string
          line_order?: number
          line_total?: number
          notes?: string | null
          order_id: string
          product_id: string
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          allocated_quantity?: number
          id?: string
          line_order?: number
          line_total?: number
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          allocated_at: string | null
          allocated_by: string | null
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          completed_by: string | null
          counterparty_account_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number
          id: string
          journal_entry_id: string | null
          notes: string | null
          order_date: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          review_notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_percent: number
          total_amount: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          allocated_at?: string | null
          allocated_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          counterparty_account_id?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          review_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          allocated_at?: string | null
          allocated_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          counterparty_account_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          review_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_percent?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_counterparty_account_id_fkey"
            columns: ["counterparty_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          batch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          order_id: string | null
          product_id: string
          quantity: number
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          order_id?: string | null
          product_id: string
          quantity: number
          unit_cost?: number
          warehouse_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          order_id?: string | null
          product_id?: string
          quantity?: number
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
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
      allocate_sale_order: {
        Args: { _allocations: Json; _order_id: string }
        Returns: undefined
      }
      approve_purchase_order: {
        Args: {
          _discount_amount?: number
          _line_costs?: Json
          _notes?: string
          _order_id: string
          _tax_percent?: number
          _warehouse_id: string
        }
        Returns: string
      }
      complete_sale_order: {
        Args: {
          _discount_amount?: number
          _notes?: string
          _order_id: string
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      reject_order: {
        Args: { _order_id: string; _review_notes?: string }
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
      journal_status: "posted"
      movement_type: "in" | "out" | "adjust" | "transfer"
      order_status:
        | "draft"
        | "pending"
        | "approved"
        | "allocated"
        | "completed"
        | "rejected"
        | "cancelled"
      order_type: "purchase" | "sale" | "sale_return" | "purchase_return"
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
      journal_status: ["posted"],
      movement_type: ["in", "out", "adjust", "transfer"],
      order_status: [
        "draft",
        "pending",
        "approved",
        "allocated",
        "completed",
        "rejected",
        "cancelled",
      ],
      order_type: ["purchase", "sale", "sale_return", "purchase_return"],
    },
  },
} as const
