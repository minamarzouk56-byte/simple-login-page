// Domain types for FinHub. These mirror the SQL schema in `supabase/schema.sql`.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type PartnerType = "customer" | "supplier" | "both";
export type JournalStatus = "posted";

export type AppPermission =
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
  | "settings.manage";

export interface Profile {
  id: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
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
  name_ar: string;
  account_type: AccountType;
  parent_id: string | null;
  level: number;
  is_leaf: boolean;
  currency_code: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Partner {
  id: string;
  code: string;
  name_ar: string;
  partner_type: PartnerType;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

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
  partner_id: string | null;
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
  "accounts.view": "عرض الحسابات",
  "accounts.create": "إنشاء حسابات",
  "accounts.edit": "تعديل الحسابات",
  "accounts.delete": "حذف الحسابات",
  "journal.view": "عرض القيود",
  "journal.create": "إنشاء قيود",
  "journal.edit": "تعديل القيود",
  "journal.delete": "حذف القيود",
  "partners.view": "عرض العملاء والموردين",
  "partners.create": "إنشاء عملاء وموردين",
  "partners.edit": "تعديل العملاء والموردين",
  "partners.delete": "حذف العملاء والموردين",
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

export const PARTNER_TYPE_LABELS_AR: Record<PartnerType, string> = {
  customer: "عميل",
  supplier: "مورد",
  both: "عميل ومورد",
};
