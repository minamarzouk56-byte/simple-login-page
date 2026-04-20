// Domain types for FinHub. These mirror the SQL schema in `supabase/schema.sql`.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type JournalStatus = "posted";

export type AppPermission =
  | "dashboard.view"
  | "accounts.view"
  | "accounts.create"
  | "accounts.edit"
  | "accounts.delete"
  | "journal.view"
  | "journal.create"
  | "journal.edit"
  | "journal.delete"
  | "customers.view"
  | "customers.create"
  | "customers.edit"
  | "customers.delete"
  | "suppliers.view"
  | "suppliers.create"
  | "suppliers.edit"
  | "suppliers.delete"
  | "reports.view"
  | "users.manage"
  | "settings.manage";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
}

export interface Currency {
  code: string;
  name_ar: string;
  symbol: string;
  is_base: boolean;
  exchange_rate: number;
  created_at: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  description: string | null;
  currency: string;
  exchange_rate: number;
  opening_balance: number;
  opening_balance_debit: number;
  opening_balance_credit: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_number: string | null;
  credit_limit: number;
  opening_balance: number;
  account_id: string | null;
  currency: string;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type Supplier = Customer;

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  reference: string | null;
  status: JournalStatus;
  total_debit: number;
  total_credit: number;
  currency_code: string;
  created_at: string;
  created_by: string | null;
}

export interface JournalEntryLine {
  id: string;
  entry_id: string;
  account_id: string;
  customer_id: string | null;
  supplier_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  currency_code: string;
  exchange_rate: number;
  line_order: number;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission: AppPermission;
  granted_at: string;
  granted_by: string | null;
}

export const PERMISSION_LABELS_AR: Record<AppPermission, string> = {
  "dashboard.view": "عرض لوحة التحكم",
  "accounts.view": "عرض الحسابات",
  "accounts.create": "إنشاء حسابات",
  "accounts.edit": "تعديل الحسابات",
  "accounts.delete": "حذف الحسابات",
  "journal.view": "عرض القيود",
  "journal.create": "إنشاء قيود",
  "journal.edit": "تعديل القيود",
  "journal.delete": "حذف القيود",
  "customers.view": "عرض العملاء",
  "customers.create": "إنشاء عملاء",
  "customers.edit": "تعديل العملاء",
  "customers.delete": "حذف العملاء",
  "suppliers.view": "عرض الموردين",
  "suppliers.create": "إنشاء موردين",
  "suppliers.edit": "تعديل الموردين",
  "suppliers.delete": "حذف الموردين",
  "reports.view": "عرض التقارير",
  "users.manage": "إدارة المستخدمين والصلاحيات",
  "settings.manage": "إدارة الإعدادات",
};

export const ACCOUNT_TYPE_LABELS_AR: Record<AccountType, string> = {
  asset: "أصول",
  liability: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};
