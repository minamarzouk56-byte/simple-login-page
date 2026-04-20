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
  | "settings.manage"
  | "inventory.view"
  | "inventory.manage"
  | "inventory.request"
  | "inventory.approve";

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
  "inventory.view": "عرض المخزون والحركات",
  "inventory.manage": "إدارة الأصناف والمخازن والفئات",
  "inventory.request": "طلب أذونات المخزون",
  "inventory.approve": "الموافقة على أذونات المخزون",
};

// =============== Inventory ===============

export type PermitType = "issue" | "receive";
export type PermitStatus = "pending" | "approved" | "rejected" | "cancelled";
export type MovementType = "in" | "out" | "adjust" | "transfer";

export const PERMIT_TYPE_LABELS_AR: Record<PermitType, string> = {
  issue: "إذن صرف",
  receive: "إذن وارد",
};

export const PERMIT_STATUS_LABELS_AR: Record<PermitStatus, string> = {
  pending: "في الانتظار",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export const MOVEMENT_TYPE_LABELS_AR: Record<MovementType, string> = {
  in: "وارد",
  out: "صرف",
  adjust: "تسوية",
  transfer: "تحويل",
};

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemCategory {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  category_id: string | null;
  default_warehouse_id: string | null;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  account_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemStock {
  id: string;
  item_id: string;
  warehouse_id: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryPermit {
  id: string;
  permit_number: string;
  permit_type: PermitType;
  permit_date: string;
  warehouse_id: string;
  counterparty_account_id: string | null;
  description: string | null;
  notes: string | null;
  status: PermitStatus;
  total_amount: number;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryPermitLine {
  id: string;
  permit_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
  line_order: number;
}

export interface StockMovement {
  id: string;
  item_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_price: number;
  permit_id: string | null;
  description: string | null;
  movement_date: string;
  created_by: string | null;
}

export const ACCOUNT_TYPE_LABELS_AR: Record<AccountType, string> = {
  asset: "أصول",
  liability: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};
