import type { AccountType } from "@/lib/finhub-types";

export interface AccountTypeStyle {
  /** CSS variable name (without var()) e.g. --acc-asset */
  var: string;
  /** Soft tint key for badge backgrounds */
  label: string;
}

export const ACCOUNT_TYPE_STYLES: Record<AccountType, AccountTypeStyle> = {
  asset:     { var: "--acc-asset",     label: "أصول" },
  liability: { var: "--acc-liability", label: "خصوم" },
  equity:    { var: "--acc-equity",    label: "حقوق ملكية" },
  revenue:   { var: "--acc-revenue",   label: "إيرادات" },
  expense:   { var: "--acc-expense",   label: "مصروفات" },
};
