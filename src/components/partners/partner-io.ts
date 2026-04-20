import ExcelJS from "exceljs";
import PDFDocument from "pdfkit/js/pdfkit.es.js";
import blobStream from "blob-stream";
import * as XLSX from "xlsx";
import CairoFontUrl from "@/assets/fonts/Cairo.ttf?url";
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

interface ExportContext {
  rows: PartnerRow[];
  accountsMap: Record<string, { code: string; name: string }>;
  movements: Record<string, number>;
  kind: PartnerKind;
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

// =====================================================
// EXCEL EXPORT (styled with ExcelJS)
// =====================================================
export const exportToExcel = async (ctx: ExportContext) => {
  const { rows, accountsMap, movements, kind } = ctx;
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinHub";
  wb.created = new Date();
  const sheetName = kind === "customer" ? "العملاء" : "الموردين";
  const ws = wb.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }],
    properties: { defaultRowHeight: 22 },
  });

  // Title
  ws.mergeCells("A1:M1");
  const title = ws.getCell("A1");
  title.value = kind === "customer" ? "كشف العملاء" : "كشف الموردين";
  title.font = { name: "Cairo", size: 18, bold: true, color: { argb: "FF1E3A8A" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Subtitle (date)
  ws.mergeCells("A2:M2");
  const sub = ws.getCell("A2");
  sub.value = `تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}  •  عدد السجلات: ${rows.length}`;
  sub.font = { name: "Cairo", size: 11, color: { argb: "FF64748B" } };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 22;

  // Spacer
  ws.getRow(3).height = 8;

  // Header row (row 4)
  const headerRow = ws.getRow(4);
  const headers = [
    HEADERS_AR.code, HEADERS_AR.name, HEADERS_AR.account_code, HEADERS_AR.account_name,
    HEADERS_AR.currency, HEADERS_AR.phone, HEADERS_AR.email, HEADERS_AR.address,
    HEADERS_AR.tax_number, HEADERS_AR.credit_limit, HEADERS_AR.opening_balance,
    HEADERS_AR.balance, HEADERS_AR.notes,
  ];
  headerRow.values = headers;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E40AF" } },
      bottom: { style: "thin", color: { argb: "FF1E40AF" } },
      left: { style: "thin", color: { argb: "FF1E40AF" } },
      right: { style: "thin", color: { argb: "FF1E40AF" } },
    };
  });

  // Data rows
  rows.forEach((p, idx) => {
    const acc = p.account_id ? accountsMap[p.account_id] : null;
    const balance = (Number(p.opening_balance) || 0) + (movements[p.id] ?? 0);
    const row = ws.addRow([
      p.code, p.name, acc?.code ?? "", acc?.name ?? "", p.currency,
      p.phone ?? "", p.email ?? "", p.address ?? "", p.tax_number ?? "",
      Number(p.credit_limit) || 0, Number(p.opening_balance) || 0, balance, p.notes ?? "",
    ]);
    row.height = 22;
    const isAlt = idx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: "Cairo", size: 10, color: { argb: "FF0F172A" } };
      cell.alignment = { horizontal: colNum >= 10 && colNum <= 12 ? "left" : "right", vertical: "middle" };
      if (isAlt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    // Numeric formats
    [10, 11, 12].forEach((c) => {
      const cell = row.getCell(c);
      cell.numFmt = "#,##0.00;[Red](#,##0.00);-";
    });
    // Color the current balance based on sign
    const balCell = row.getCell(12);
    if (balance > 0) balCell.font = { name: "Cairo", size: 10, bold: true, color: { argb: "FF15803D" } };
    else if (balance < 0) balCell.font = { name: "Cairo", size: 10, bold: true, color: { argb: "FFDC2626" } };
    else balCell.font = { name: "Cairo", size: 10, color: { argb: "FF94A3B8" } };
  });

  // Column widths
  const widths = [10, 28, 14, 28, 8, 16, 26, 30, 16, 14, 16, 16, 30];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Totals row
  if (rows.length) {
    const totalCredit = rows.reduce((s, p) => s + (Number(p.credit_limit) || 0), 0);
    const totalOpening = rows.reduce((s, p) => s + (Number(p.opening_balance) || 0), 0);
    const totalBalance = rows.reduce(
      (s, p) => s + (Number(p.opening_balance) || 0) + (movements[p.id] ?? 0), 0,
    );
    const totRow = ws.addRow([
      "", "الإجمالي", "", "", "", "", "", "", "", totalCredit, totalOpening, totalBalance, "",
    ]);
    totRow.height = 26;
    totRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: "FF0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      cell.alignment = { horizontal: colNum >= 10 && colNum <= 12 ? "left" : "right", vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: "FFCA8A04" } },
        bottom: { style: "medium", color: { argb: "FFCA8A04" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    [10, 11, 12].forEach((c) => { totRow.getCell(c).numFmt = "#,##0.00;[Red](#,##0.00);-"; });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = `${kind === "customer" ? "customers" : "suppliers"}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  triggerDownload(blob, filename);
};

// =====================================================
// EXCEL TEMPLATE (styled)
// =====================================================
export const downloadTemplate = async (kind: PartnerKind) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("قالب", { views: [{ rightToLeft: true }] });

  const headers = [
    HEADERS_AR.name, HEADERS_AR.phone, HEADERS_AR.email, HEADERS_AR.address,
    HEADERS_AR.tax_number, HEADERS_AR.currency, HEADERS_AR.account_code,
    HEADERS_AR.credit_limit, HEADERS_AR.opening_balance, HEADERS_AR.notes,
  ];
  ws.addRow(headers);
  ws.getRow(1).height = 28;
  ws.getRow(1).eachCell((cell) => {
    cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  const example = [
    kind === "customer" ? "شركة المثال للتجارة" : "مورد المثال",
    "01000000000", "example@mail.com", "القاهرة، مصر", "100-200-300",
    "EGP", "1101001", 0, 0, "",
  ];
  const exRow = ws.addRow(example);
  exRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: "Cairo", size: 10, italic: true, color: { argb: "FF64748B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = 22; });

  // Instructions sheet
  const info = wb.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  info.getColumn(1).width = 80;
  const lines = [
    "تعليمات استخدام القالب",
    "",
    "1) لا تغيّر أسماء الأعمدة في الصف الأول.",
    "2) عمود (العملة) يجب أن يحتوي على رمز العملة مثل: EGP, USD, EUR.",
    "3) عمود (كود الحساب المرتبط) يجب أن يطابق كود حساب فرعي موجود بنفس العملة.",
    "4) إذا تركت عمود الحساب فارغاً، سيتم إنشاء السجل بدون ربط بحساب.",
    "5) الأعمدة الرقمية (حد الائتمان / الرصيد الافتتاحي) أرقام عشرية.",
    "6) سيتم توليد الكود تلقائياً للسجلات الجديدة.",
  ];
  lines.forEach((l, i) => {
    const c = info.getCell(`A${i + 1}`);
    c.value = l;
    c.font = { name: "Cairo", size: i === 0 ? 14 : 11, bold: i === 0, color: { argb: i === 0 ? "FF1E3A8A" : "FF0F172A" } };
    c.alignment = { horizontal: "right", vertical: "middle" };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, `${kind}_template.xlsx`);
};

// =====================================================
// EXCEL IMPORT (uses xlsx for simple parsing)
// =====================================================
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

// =====================================================
// PDF EXPORT (pdfkit + Cairo font, full Arabic shaping)
// =====================================================
let cairoFontPromise: Promise<ArrayBuffer> | null = null;
const loadCairoFont = (): Promise<ArrayBuffer> => {
  if (!cairoFontPromise) {
    cairoFontPromise = fetch(CairoFontUrl).then((r) => {
      if (!r.ok) throw new Error("Failed to load Arabic font");
      return r.arrayBuffer();
    });
  }
  return cairoFontPromise;
};

export const exportToPdf = async (ctx: ExportContext) => {
  const { rows, accountsMap, movements, kind } = ctx;
  const fontBuf = await loadCairoFont();

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30, bufferPages: true });
  const stream = doc.pipe(blobStream());

  doc.registerFont("Cairo", fontBuf);
  doc.font("Cairo");

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const rtlOpts = { features: ["rtla"] as string[] };

  // ============ Header ============
  const drawHeader = () => {
    doc.fillColor("#1e3a8a").fontSize(18);
    doc.text(kind === "customer" ? "كشف العملاء" : "كشف الموردين", 30, 30, {
      width: pageWidth - 60, align: "right", ...rtlOpts, lineBreak: false,
    });
    doc.fontSize(9).fillColor("#64748b");
    // Use English digit format separately to avoid bidi flipping
    const dateStr = new Date().toLocaleDateString("ar-EG-u-nu-arab");
    doc.text(`تاريخ التصدير: ${dateStr}  •  عدد السجلات: ${rows.length}`, 30, 56, {
      width: pageWidth - 60, align: "right", ...rtlOpts, lineBreak: false,
    });
    // Divider line
    doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(30, 78).lineTo(pageWidth - 30, 78).stroke();
  };

  drawHeader();

  // ============ Table ============
  const headers = ["الكود", "الاسم", "الحساب المرتبط", "العملة", "الهاتف", "حد الائتمان", "الرصيد"];
  const colWidths = [55, 175, 195, 50, 95, 80, 80]; // total 730
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const startX = (pageWidth - totalW) / 2;
  const headerH = 26;
  const rowH = 22;
  let y = 95;

  const drawTableHeader = () => {
    doc.rect(startX, y, totalW, headerH).fill("#2563eb");
    doc.fillColor("#ffffff").fontSize(10);
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 8, {
        width: colWidths[i] - 8, align: "center", ...rtlOpts, lineBreak: false,
      });
      x += colWidths[i];
    });
    y += headerH;
  };

  drawTableHeader();

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  rows.forEach((p, idx) => {
    if (y + rowH > pageHeight - 40) {
      doc.addPage();
      y = 40;
      drawTableHeader();
    }
    const acc = p.account_id ? accountsMap[p.account_id] : null;
    const balance = (Number(p.opening_balance) || 0) + (movements[p.id] ?? 0);
    const cells = [
      p.code,
      p.name,
      acc ? `${acc.name}` : "—",
      p.currency,
      p.phone ?? "—",
      Number(p.credit_limit) > 0 ? fmtMoney(Number(p.credit_limit)) : "—",
      fmtMoney(balance),
    ];
    if (idx % 2 === 0) {
      doc.rect(startX, y, totalW, rowH).fill("#f8fafc");
    }
    let x = startX;
    doc.fontSize(9);
    cells.forEach((cell, i) => {
      const isNumeric = i >= 5;
      let color = "#0f172a";
      if (i === 6) {
        if (balance > 0) color = "#15803d";
        else if (balance < 0) color = "#dc2626";
        else color = "#94a3b8";
      } else if (i === 0) color = "#64748b";
      doc.fillColor(color);
      doc.text(String(cell), x + 4, y + 6, {
        width: colWidths[i] - 8,
        align: isNumeric ? "left" : i === 3 ? "center" : "right",
        ...rtlOpts,
        lineBreak: false,
        ellipsis: true,
      });
      x += colWidths[i];
    });
    // Row border
    doc.strokeColor("#e2e8f0").lineWidth(0.4).moveTo(startX, y + rowH).lineTo(startX + totalW, y + rowH).stroke();
    y += rowH;
  });

  // ============ Page numbers ============
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fillColor("#94a3b8").fontSize(8);
    doc.text(`صفحة ${i + 1} من ${range.count}`, 30, pageHeight - 25, {
      width: pageWidth - 60, align: "center", ...rtlOpts, lineBreak: false,
    });
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => {
      const blob = stream.toBlob("application/pdf");
      const filename = `${kind === "customer" ? "customers" : "suppliers"}_${new Date()
        .toISOString().slice(0, 10)}.pdf`;
      triggerDownload(blob, filename);
      resolve();
    });
    stream.on("error", reject);
  });
};
