import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2, FileSpreadsheet, FileDown, FileUp, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  exportToExcel,
  exportToPdf,
  downloadTemplate,
  parseImportFile,
  type PartnerKind,
  type PartnerRow,
} from "./partner-io";

interface Props {
  kind: PartnerKind;
  rows: PartnerRow[];
  accountsMap: Record<string, { code: string; name: string }>;
  movements: Record<string, number>;
  onImported: () => void;
}

export const PartnerOperationsMenu = ({
  kind,
  rows,
  accountsMap,
  movements,
  onImported,
}: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const table = kind === "customer" ? "customers" : "suppliers";

  const handleExportExcel = () => {
    if (!rows.length) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    exportToExcel({ rows, accountsMap, movements, kind });
    toast({ title: "تم تصدير ملف Excel" });
  };

  const handleExportPdf = async () => {
    if (!rows.length) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await exportToPdf({ rows, accountsMap, movements, kind });
      toast({ title: "تم تصدير ملف PDF" });
    } catch (e: any) {
      toast({ title: "تعذر تصدير PDF", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseImportFile(file);
      if (!parsed.length) {
        toast({ title: "لم يتم العثور على صفوف صالحة", variant: "destructive" });
        return;
      }
      // Build account-code map
      const { data: accs } = await supabase.from("accounts").select("id, code, currency");
      const accByCode: Record<string, { id: string; currency: string }> = {};
      (accs ?? []).forEach((a: any) => {
        accByCode[a.code] = { id: a.id, currency: a.currency };
      });

      const payloads: any[] = [];
      const skipped: string[] = [];
      // Generate codes sequentially based on existing max
      const { data: existing } = await supabase.from(table).select("code");
      let maxNum = 0;
      (existing ?? []).forEach((r: any) => {
        const n = parseInt(String(r.code).replace(/\D/g, ""), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      });
      const prefix = kind === "customer" ? "C" : "S";

      for (const row of parsed) {
        let account_id: string | null = null;
        let currency = row.currency || "EGP";
        if (row.account_code) {
          const acc = accByCode[row.account_code];
          if (!acc) {
            skipped.push(`${row.name}: كود الحساب "${row.account_code}" غير موجود`);
            continue;
          }
          account_id = acc.id;
          currency = acc.currency;
        }
        maxNum += 1;
        payloads.push({
          code: `${prefix}${String(maxNum).padStart(4, "0")}`,
          name: row.name,
          phone: row.phone || null,
          email: row.email || null,
          address: row.address || null,
          tax_number: row.tax_number || null,
          credit_limit: row.credit_limit || 0,
          opening_balance: row.opening_balance || 0,
          notes: row.notes || null,
          currency,
          account_id,
        });
      }

      if (!payloads.length) {
        toast({
          title: "تعذر الاستيراد",
          description: skipped[0] ?? "تحقق من البيانات",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from(table).insert(payloads as never);
      if (error) {
        toast({ title: "فشل الاستيراد", description: error.message, variant: "destructive" });
        return;
      }
      toast({
        title: `تم استيراد ${payloads.length} سجل`,
        description: skipped.length ? `تم تخطي ${skipped.length} صف` : undefined,
      });
      onImported();
    } catch (err: any) {
      toast({ title: "تعذرت قراءة الملف", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            العمليات
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <FileUp className="h-4 w-4" />
            <span>استيراد Excel</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadTemplate(kind)}>
            <FileDown className="h-4 w-4" />
            <span>تحميل قالب Excel</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportPdf}>
            <FileText className="h-4 w-4" />
            <span>تصدير PDF</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
