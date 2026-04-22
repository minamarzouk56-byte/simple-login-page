import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { ItemRow } from "./inventory-lib";

export const exportItemsToExcel = (rows: ItemRow[]) => {
  const data = rows.map((r) => ({
    الكود: r.code,
    الاسم: r.name,
    الوحدة: r.unit,
    الفئة: r.category_name ?? "",
    "المخزن الافتراضي": r.default_warehouse_name ?? "",
    "سعر التكلفة": Number(r.cost_price) || 0,
    "سعر البيع": Number(r.sale_price) || 0,
    "الرصيد الكلي": Number(r.total_quantity) || 0,
    "الحد الأدنى": Number(r.min_stock) || 0,
    "الحساب المرتبط": r.account_label ?? "",
    "نشط؟": r.is_active ? "نعم" : "لا",
    الوصف: r.description ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 24 },
    { wch: 8 }, { wch: 30 },
  ];
  ws["!rtl"] = true;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الأصناف");
  XLSX.writeFile(wb, `inventory_items_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const downloadItemsTemplate = () => {
  const sample = [
    {
      الكود: "(فارغ يولد تلقائياً)",
      الاسم: "صنف نموذجي",
      الوحدة: "قطعة",
      "اسم الفئة": "",
      "اسم المخزن الافتراضي": "",
      "سعر التكلفة": 0,
      "سعر البيع": 0,
      "الحد الأدنى": 0,
      "كود الحساب المرتبط": "",
      الوصف: "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = Array(10).fill({ wch: 22 });
  ws["!rtl"] = true;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "قالب الأصناف");
  XLSX.writeFile(wb, "items_template.xlsx");
};

export interface ImportRow {
  code?: string;
  name?: string;
  unit?: string;
  category_name?: string;
  warehouse_name?: string;
  cost_price?: number;
  sale_price?: number;
  min_stock?: number;
  account_code?: string;
  description?: string;
}

export const parseImportFile = async (file: File): Promise<ImportRow[]> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
  return json.map((r) => ({
    code: String(r["الكود"] ?? "").trim() || undefined,
    name: String(r["الاسم"] ?? "").trim(),
    unit: String(r["الوحدة"] ?? "قطعة").trim(),
    category_name: String(r["اسم الفئة"] ?? "").trim() || undefined,
    warehouse_name: String(r["اسم المخزن الافتراضي"] ?? "").trim() || undefined,
    cost_price: Number(r["سعر التكلفة"]) || 0,
    sale_price: Number(r["سعر البيع"]) || 0,
    min_stock: Number(r["الحد الأدنى"]) || 0,
    account_code: String(r["كود الحساب المرتبط"] ?? "").trim() || undefined,
    description: String(r["الوصف"] ?? "").trim() || undefined,
  }));
};

export const importItems = async (
  rows: ImportRow[],
  catMap: Map<string, string>,
  whMap: Map<string, string>,
  accMap: Map<string, string>,
) => {
  const valid = rows.filter((r) => r.name && r.name.length > 0);
  if (valid.length === 0) throw new Error("لا توجد بيانات صحيحة للاستيراد");
  const payload = valid.map((r) => ({
    code: r.code && !r.code.startsWith("(") ? r.code : "",
    name: r.name!,
    unit: r.unit || "قطعة",
    category_id: r.category_name ? catMap.get(r.category_name) ?? null : null,
    default_warehouse_id: r.warehouse_name ? whMap.get(r.warehouse_name) ?? null : null,
    cost_price: r.cost_price ?? 0,
    sale_price: r.sale_price ?? 0,
    min_stock: r.min_stock ?? 0,
    account_id: r.account_code ? accMap.get(r.account_code) ?? null : null,
    description: r.description ?? null,
    is_active: true,
  }));
  const { error } = await supabase.from("items").insert(payload as never);
  if (error) throw new Error(error.message);
  return valid.length;
};

export const exportItemsToPDF = (rows: ItemRow[]) => {
  // Use browser print for Arabic-friendly PDF (no font embedding issues)
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>قائمة الأصناف</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: -apple-system, "Segoe UI", "Tajawal", "Cairo", Arial, sans-serif; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th, td { border: 1px solid #d0d0d0; padding: 5px 7px; text-align: right; }
    thead { background: #f5f5f5; }
    th { font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    .num { font-variant-numeric: tabular-nums; text-align: left; }
  </style>
</head>
<body>
  <h1>قائمة أصناف المخزون</h1>
  <div class="meta">تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")} • عدد الأصناف: ${rows.length}</div>
  <table>
    <thead>
      <tr>
        <th>الكود</th><th>الاسم</th><th>الوحدة</th><th>الفئة</th>
        <th>المخزن</th><th>التكلفة</th><th>البيع</th><th>الرصيد</th><th>الحد الأدنى</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r) => `
        <tr>
          <td>${r.code}</td>
          <td>${r.name}</td>
          <td>${r.unit}</td>
          <td>${r.category_name ?? "—"}</td>
          <td>${r.default_warehouse_name ?? "—"}</td>
          <td class="num">${(Number(r.cost_price) || 0).toFixed(2)}</td>
          <td class="num">${(Number(r.sale_price) || 0).toFixed(2)}</td>
          <td class="num">${(Number(r.total_quantity) || 0).toFixed(2)}</td>
          <td class="num">${(Number(r.min_stock) || 0).toFixed(2)}</td>
        </tr>`).join("")}
    </tbody>
  </table>
  <script>window.onload = () => { setTimeout(() => window.print(), 200); };</script>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
};
