import { supabase } from "@/integrations/supabase/client";
import type {
  Warehouse,
  ItemCategory,
  InventoryItem,
  InventoryPermit,
  InventoryPermitLine,
  StockMovement,
  ItemStock,
} from "@/lib/finhub-types";

export const fmtNumber = (n: number) =>
  new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
}

export interface ItemRow extends InventoryItem {
  category_name: string | null;
  default_warehouse_name: string | null;
  account_label: string | null;
  total_quantity: number;
  per_warehouse: WarehouseStock[];
}

export const loadInventoryData = async () => {
  const [wh, cats, its, stocks, accs] = await Promise.all([
    supabase.from("warehouses").select("*").eq("is_active", true).order("code"),
    supabase.from("item_categories").select("*").eq("is_active", true).order("code"),
    supabase.from("items").select("*").order("code"),
    supabase.from("item_stock").select("*"),
    supabase.from("accounts").select("id, code, name, currency"),
  ]);

  const warehouses = (wh.data ?? []) as Warehouse[];
  const categories = (cats.data ?? []) as ItemCategory[];
  const items = (its.data ?? []) as InventoryItem[];
  const stockRows = (stocks.data ?? []) as ItemStock[];
  const accounts = (accs.data ?? []) as { id: string; code: string; name: string; currency: string }[];

  const whMap = new Map(warehouses.map((w) => [w.id, w]));
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  const stockByItem = new Map<string, WarehouseStock[]>();
  stockRows.forEach((s) => {
    const arr = stockByItem.get(s.item_id) ?? [];
    arr.push({
      warehouse_id: s.warehouse_id,
      warehouse_name: whMap.get(s.warehouse_id)?.name ?? "—",
      quantity: Number(s.quantity),
    });
    stockByItem.set(s.item_id, arr);
  });

  const rows: ItemRow[] = items.map((it) => {
    const per = stockByItem.get(it.id) ?? [];
    const total = per.reduce((sum, p) => sum + p.quantity, 0);
    const acc = it.account_id ? accMap.get(it.account_id) : null;
    return {
      ...it,
      category_name: it.category_id ? catMap.get(it.category_id)?.name ?? null : null,
      default_warehouse_name: it.default_warehouse_id ? whMap.get(it.default_warehouse_id)?.name ?? null : null,
      account_label: acc ? `${acc.code} - ${acc.name}` : null,
      total_quantity: total,
      per_warehouse: per,
    };
  });

  return { warehouses, categories, items, stockRows, accounts, rows, whMap, catMap, accMap };
};

export const loadPermitWithLines = async (permitId: string) => {
  const [{ data: permit }, { data: lines }] = await Promise.all([
    supabase.from("inventory_permits").select("*").eq("id", permitId).maybeSingle(),
    supabase.from("inventory_permit_lines").select("*").eq("permit_id", permitId).order("line_order"),
  ]);
  return {
    permit: (permit ?? null) as InventoryPermit | null,
    lines: (lines ?? []) as InventoryPermitLine[],
  };
};

export const loadMovements = async () => {
  const { data } = await supabase
    .from("stock_movements")
    .select("*")
    .order("movement_date", { ascending: false })
    .limit(500);
  return (data ?? []) as StockMovement[];
};
