import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Customer } from "@/lib/finhub-types";

export type PartnerKind = "customer" | "supplier";

export interface PartnerRow extends Customer {}

export interface ImportRow {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tax_number?: string | null;
  credit_limit?: number;
  opening_balance?: number;
  currency?: string;
  account_code?: string | null;
  notes?: string | null;
}

const HEADERS_AR = {
  code: "الكود",
  name: "الاسم",
  phone: "الهاتف",
  email: "البريد الإلكتروني",
  address: "العنوان",
  tax_number: "الرقم الضريبي",
  account_code: "كود الحساب المرتبط",
  account_name: "اسم الحساب المرتبط",
  currency: "العملة",
  credit_limit: "حد الائتمان",
  opening_balance: "الرصيد الافتتاحي",
  balance: "الرصيد الحالي",
  notes: "ملاحظات",
};

const fmtNum = (n: number) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ExportContext {
  rows: PartnerRow[];
  accountsMap: Record<string, { code: string; name: string }>;
  movements: Record<string, number>;
  kind: PartnerKind;
}

const buildAoa = ({ rows, accountsMap, movements, kind }: ExportContext): (string | number)[][] => {
  const header = [
    HEADERS_AR.code,
    HEADERS_AR.name,
    HEADERS_AR.account_code,
    HEADERS_AR.account_name,
    HEADERS_AR.currency,
    HEADERS_AR.phone,
    HEADERS_AR.email,
    HEADERS_AR.address,
    HEADERS_AR.tax_number,
    HEADERS_AR.credit_limit,
    HEADERS_AR.opening_balance,
    HEADERS_AR.balance,
    HEADERS_AR.notes,
  ];
  const body = rows.map((p) => {
    const acc = p.account_id ? accountsMap[p.account_id] : null;
    const balance = (Number(p.opening_balance) || 0) + (movements[p.id] ?? 0);
    return [
      p.code,
      p.name,
      acc?.code ?? "",
      acc?.name ?? "",
      p.currency,
      p.phone ?? "",
      p.email ?? "",
      p.address ?? "",
      p.tax_number ?? "",
      Number(p.credit_limit) || 0,
      Number(p.opening_balance) || 0,
      balance,
      p.notes ?? "",
    ];
  });
  return [header, ...body];
};

export const exportToExcel = (ctx: ExportContext) => {
  const aoa = buildAoa(ctx);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 10 }, { wch: 26 }, { wch: 14 }, { wch: 26 }, { wch: 8 },
    { wch: 16 }, { wch: 24 }, { wch: 28 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
  ];
  ws["!views"] = [{ RTL: true }];
  // Number format on numeric cols (J, K, L) starting row 2
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of [9, 10, 11]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr]) ws[addr].z = "#,##0.00;(#,##0.00);-";
    }
  }
  const wb = XLSX.utils.book_new();
  const sheetName = ctx.kind === "customer" ? "العملاء" : "الموردين";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const filename = `${ctx.kind === "customer" ? "customers" : "suppliers"}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const downloadTemplate = (kind: PartnerKind) => {
  const header = [
    HEADERS_AR.name,
    HEADERS_AR.phone,
    HEADERS_AR.email,
    HEADERS_AR.address,
    HEADERS_AR.tax_number,
    HEADERS_AR.currency,
    HEADERS_AR.account_code,
    HEADERS_AR.credit_limit,
    HEADERS_AR.opening_balance,
    HEADERS_AR.notes,
  ];
  const example = [
    kind === "customer" ? "شركة المثال للتجارة" : "مورد المثال",
    "01000000000",
    "example@mail.com",
    "القاهرة، مصر",
    "100-200-300",
    "EGP",
    "1101001",
    0,
    0,
    "",
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  ws["!views"] = [{ RTL: true }];
  ws["!cols"] = header.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "قالب");
  XLSX.writeFile(wb, `${kind}_template.xlsx`);
};

export const parseImportFile = async (file: File): Promise<ImportRow[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  return json
    .map((r) => {
      const get = (k: string) => {
        const v = r[k];
        if (v === undefined || v === null) return "";
        return String(v).trim();
      };
      const name = get(HEADERS_AR.name);
      if (!name) return null;
      return {
        name,
        phone: get(HEADERS_AR.phone) || null,
        email: get(HEADERS_AR.email) || null,
        address: get(HEADERS_AR.address) || null,
        tax_number: get(HEADERS_AR.tax_number) || null,
        currency: get(HEADERS_AR.currency) || "EGP",
        account_code: get(HEADERS_AR.account_code) || null,
        credit_limit: Number(get(HEADERS_AR.credit_limit)) || 0,
        opening_balance: Number(get(HEADERS_AR.opening_balance)) || 0,
        notes: get(HEADERS_AR.notes) || null,
      } as ImportRow;
    })
    .filter((r): r is ImportRow => r !== null);
};

// --- PDF export with Arabic font ---
let amiriFontPromise: Promise<string | null> | null = null;
const loadAmiriBase64 = (): Promise<string | null> => {
  if (amiriFontPromise) return amiriFontPromise;
  amiriFontPromise = (async () => {
    try {
      const url =
        "https://cdn.jsdelivr.net/gh/aliftype/amiri@1.000/fonts/ttf/Amiri-Regular.ttf";
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    } catch {
      return null;
    }
  })();
  return amiriFontPromise;
};

export const exportToPdf = async (ctx: ExportContext) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const fontB64 = await loadAmiriBase64();
  let font = "helvetica";
  if (fontB64) {
    doc.addFileToVFS("Amiri-Regular.ttf", fontB64);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    font = "Amiri";
  }
  doc.setFont(font);

  const title = ctx.kind === "customer" ? "كشف العملاء" : "كشف الموردين";
  const dateStr = new Date().toLocaleDateString("ar-EG");
  doc.setFontSize(16);
  doc.text(title, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });
  doc.setFontSize(10);
  doc.text(`تاريخ التصدير: ${dateStr}`, doc.internal.pageSize.getWidth() - 40, 58, {
    align: "right",
  });

  const aoa = buildAoa(ctx);
  const head = [aoa[0]];
  const body = aoa.slice(1).map((r) =>
    r.map((c, i) => (i >= 9 && i <= 11 ? fmtNum(Number(c) || 0) : String(c ?? ""))),
  );

  autoTable(doc, {
    head,
    body,
    startY: 75,
    styles: {
      font,
      fontSize: 8,
      cellPadding: 4,
      halign: "right",
      valign: "middle",
      lineWidth: 0.3,
      lineColor: [220, 220, 220],
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "normal",
      halign: "right",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      9: { halign: "left" },
      10: { halign: "left" },
      11: { halign: "left", fontStyle: "normal" },
    },
    margin: { left: 20, right: 20 },
    didDrawPage: (data) => {
      const str = `صفحة ${doc.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 12);
    },
  });

  const filename = `${ctx.kind === "customer" ? "customers" : "suppliers"}_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
};
