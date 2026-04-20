import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import { ACCOUNT_TYPE_LABELS_AR, type Account } from "@/lib/finhub-types";
import { ACCOUNT_TYPE_STYLES } from "./account-styles";

interface StatementRow {
  date: string;
  description: string | null;
  reference: string | null;
  entry_number: string;
  type_label: string;
  currency: string;
  exchange_rate: number;
  debit: number;
  credit: number;
}

interface Props {
  account: Account | null;
  allAccounts: Account[];
  onOpenChange: (open: boolean) => void;
}

export const AccountStatementDialog = ({ account, allAccounts, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  // collect all descendant ids (including self)
  const descendantIds = useMemo(() => {
    if (!account) return [];
    const ids = new Set<string>([account.id]);
    let added = true;
    while (added) {
      added = false;
      allAccounts.forEach((a) => {
        if (a.parent_id && ids.has(a.parent_id) && !ids.has(a.id)) {
          ids.add(a.id);
          added = true;
        }
      });
    }
    return Array.from(ids);
  }, [account, allAccounts]);

  useEffect(() => {
    if (!account) {
      setRows([]);
      return;
    }

    const load = async () => {
      setLoading(true);

      // Aggregate opening balances of self + descendants (debit - credit)
      const accSubset = allAccounts.filter((a) => descendantIds.includes(a.id));
      const opening = accSubset.reduce(
        (sum, a) => sum + (Number(a.opening_balance_debit) || 0) - (Number(a.opening_balance_credit) || 0),
        0,
      );
      setOpeningBalance(opening);

      const { data: lines, error } = await supabase
        .from("journal_entry_lines")
        .select("id, account_id, debit, credit, description, currency_code, exchange_rate, entry_id")
        .in("account_id", descendantIds);

      if (error) {
        toast({ title: "تعذر تحميل كشف الحساب", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const entryIds = Array.from(new Set((lines ?? []).map((l) => l.entry_id)));
      let entriesMap = new Map<string, { entry_date: string; entry_number: string; reference: string | null; description: string | null }>();
      if (entryIds.length > 0) {
        const { data: entries } = await supabase
          .from("journal_entries")
          .select("id, entry_date, entry_number, reference, description")
          .in("id", entryIds);
        entriesMap = new Map((entries ?? []).map((e) => [e.id, e]));
      }

      const accMap = new Map(allAccounts.map((a) => [a.id, a]));

      const built: StatementRow[] = (lines ?? [])
        .map((l) => {
          const entry = entriesMap.get(l.entry_id);
          const acc = accMap.get(l.account_id);
          return {
            date: entry?.entry_date ?? "",
            description: l.description ?? entry?.description ?? null,
            reference: entry?.reference ?? null,
            entry_number: entry?.entry_number ?? "",
            type_label: acc ? ACCOUNT_TYPE_LABELS_AR[acc.type] : "",
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
  }, [account, descendantIds, allAccounts, toast]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + r.debit, 0);
    const credit = rows.reduce((s, r) => s + r.credit, 0);
    return { debit, credit, balance: openingBalance + debit - credit };
  }, [rows, openingBalance]);

  const fmt = (n: number) => n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const style = account ? ACCOUNT_TYPE_STYLES[account.type] : null;

  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            كشف حساب: {account?.name}
            {account && (
              <Badge variant="outline" className="font-mono text-xs">{account.code}</Badge>
            )}
            {style && (
              <span
                className="px-2 py-0.5 text-xs rounded-md border"
                style={{
                  color: `hsl(var(${style.var}))`,
                  borderColor: `hsl(var(${style.var}) / 0.4)`,
                  backgroundColor: `hsl(var(${style.var}) / 0.08)`,
                }}
              >
                {ACCOUNT_TYPE_LABELS_AR[account!.type]}
              </span>
            )}
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
                  <TableHead className="text-start">النوع</TableHead>
                  <TableHead className="text-start">العملة</TableHead>
                  <TableHead className="text-end">المعامل</TableHead>
                  <TableHead className="text-end">مدين</TableHead>
                  <TableHead className="text-end">دائن</TableHead>
                  <TableHead className="text-end">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening balance row */}
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell colSpan={5}>رصيد افتتاحي</TableCell>
                  <TableCell></TableCell>
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
                      لا توجد حركات على هذا الحساب.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => {
                    const running = openingBalance + rows.slice(0, i + 1).reduce((s, x) => s + x.debit - x.credit, 0);
                    return (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums whitespace-nowrap">{r.date}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={r.description ?? ""}>{r.description ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{r.reference || r.entry_number}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{r.type_label}</Badge></TableCell>
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

                {/* Totals row */}
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
