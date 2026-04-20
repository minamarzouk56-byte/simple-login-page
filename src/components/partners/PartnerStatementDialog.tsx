import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import type { Customer } from "@/lib/finhub-types";

interface StatementRow {
  date: string;
  description: string | null;
  reference: string | null;
  entry_number: string;
  account_code: string;
  account_name: string;
  currency: string;
  exchange_rate: number;
  debit: number;
  credit: number;
}

interface Props {
  partner: Customer | null;
  kind: "customer" | "supplier";
  onOpenChange: (open: boolean) => void;
}

export const PartnerStatementDialog = ({ partner, kind, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StatementRow[]>([]);

  const fkColumn = kind === "customer" ? "customer_id" : "supplier_id";
  const openingBalance = Number(partner?.opening_balance ?? 0);

  useEffect(() => {
    if (!partner) {
      setRows([]);
      return;
    }

    const load = async () => {
      setLoading(true);

      const { data: lines, error } = await supabase
        .from("journal_entry_lines")
        .select("id, account_id, debit, credit, description, currency_code, exchange_rate, entry_id")
        .eq(fkColumn, partner.id);

      if (error) {
        toast({ title: "تعذر تحميل كشف الحساب", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const entryIds = Array.from(new Set((lines ?? []).map((l) => l.entry_id)));
      const accountIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));

      const [entriesRes, accountsRes] = await Promise.all([
        entryIds.length
          ? supabase.from("journal_entries").select("id, entry_date, entry_number, reference, description").in("id", entryIds)
          : Promise.resolve({ data: [] as never[] }),
        accountIds.length
          ? supabase.from("accounts").select("id, code, name").in("id", accountIds)
          : Promise.resolve({ data: [] as never[] }),
      ]);

      const entriesMap = new Map((entriesRes.data ?? []).map((e: any) => [e.id, e]));
      const accountsMap = new Map((accountsRes.data ?? []).map((a: any) => [a.id, a]));

      const built: StatementRow[] = (lines ?? [])
        .map((l) => {
          const entry = entriesMap.get(l.entry_id) as any;
          const acc = accountsMap.get(l.account_id) as any;
          return {
            date: entry?.entry_date ?? "",
            description: l.description ?? entry?.description ?? null,
            reference: entry?.reference ?? null,
            entry_number: entry?.entry_number ?? "",
            account_code: acc?.code ?? "",
            account_name: acc?.name ?? "",
            currency: l.currency_code,
            exchange_rate: Number(l.exchange_rate) || 1,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          };
        })
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.entry_number.localeCompare(b.entry_number)));

      setRows(built);
      setLoading(false);
    };

    load();
  }, [partner, fkColumn, toast]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + r.debit, 0);
    const credit = rows.reduce((s, r) => s + r.credit, 0);
    return { debit, credit, balance: openingBalance + debit - credit };
  }, [rows, openingBalance]);

  const fmt = (n: number) => n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={!!partner} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            كشف حساب: {partner?.name}
            {partner && <Badge variant="outline" className="font-mono text-xs">{partner.code}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                <TableRow>
                  <TableHead className="text-start">التاريخ</TableHead>
                  <TableHead className="text-start">البيان</TableHead>
                  <TableHead className="text-start">المرجع</TableHead>
                  <TableHead className="text-start">الحساب</TableHead>
                  <TableHead className="text-start">العملة</TableHead>
                  <TableHead className="text-end">المعامل</TableHead>
                  <TableHead className="text-end">مدين</TableHead>
                  <TableHead className="text-end">دائن</TableHead>
                  <TableHead className="text-end">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell colSpan={6}>رصيد افتتاحي</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {openingBalance > 0 ? fmt(openingBalance) : "-"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {openingBalance < 0 ? fmt(-openingBalance) : "-"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">{fmt(openingBalance)}</TableCell>
                </TableRow>

                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      لا توجد حركات على هذا الطرف.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => {
                    const running = openingBalance + rows.slice(0, i + 1).reduce((s, x) => s + x.debit - x.credit, 0);
                    return (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums whitespace-nowrap">{r.date}</TableCell>
                        <TableCell className="max-w-[260px] truncate" title={r.description ?? ""}>{r.description ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{r.reference || r.entry_number}</TableCell>
                        <TableCell className="text-xs">
                          <span className="font-mono text-muted-foreground">{r.account_code}</span>
                          <span className="mx-1">·</span>
                          {r.account_name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.currency}</TableCell>
                        <TableCell className="text-end tabular-nums">{r.exchange_rate.toFixed(4)}</TableCell>
                        <TableCell className="text-end tabular-nums text-success">
                          {r.debit > 0 ? fmt(r.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-destructive">
                          {r.credit > 0 ? fmt(r.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-end tabular-nums font-medium">{fmt(running)}</TableCell>
                      </TableRow>
                    );
                  })
                )}

                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell colSpan={6}>الإجماليات</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(totals.debit)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(totals.credit)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(totals.balance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
