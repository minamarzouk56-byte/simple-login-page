import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Loader2 } from "lucide-react";
import { ACCOUNT_TYPE_LABELS_AR, type Account, type AccountType, type JournalEntryLine } from "@/lib/finhub-types";

interface AccountBalance {
  account: Account;
  debit: number;
  credit: number;
  balance: number;
}

const Reports = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<JournalEntryLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: accs, error: accErr }, { data: lns, error: lnErr }] = await Promise.all([
        supabase.from("accounts").select("*").order("code"),
        supabase.from("journal_entry_lines").select("*"),
      ]);
      if (accErr || lnErr) {
        toast({ title: "فشل تحميل التقارير", description: (accErr ?? lnErr)?.message, variant: "destructive" });
      }
      setAccounts((accs ?? []) as Account[]);
      setLines((lns ?? []) as JournalEntryLine[]);
      setLoading(false);
    };
    load();
  }, [toast]);

  const balances = useMemo<AccountBalance[]>(() => {
    const parentIds = new Set(accounts.map((a) => a.parent_id).filter(Boolean) as string[]);
    return accounts
      .filter((a) => !parentIds.has(a.id))
      .map((account) => {
        const acctLines = lines.filter((l) => l.account_id === account.id);
        const debit = acctLines.reduce((s, l) => s + Number(l.debit), 0);
        const credit = acctLines.reduce((s, l) => s + Number(l.credit), 0);
        const balance = ["asset", "expense"].includes(account.type) ? debit - credit : credit - debit;
        return { account, debit, credit, balance };
      });
  }, [accounts, lines]);

  const trialBalance = balances.filter((b) => b.debit > 0 || b.credit > 0);

  const totalsByType = useMemo(() => {
    const totals: Record<AccountType, number> = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 };
    balances.forEach((b) => { totals[b.account.type] += b.balance; });
    return totals;
  }, [balances]);

  const netIncome = totalsByType.revenue - totalsByType.expense;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> التقارير المالية
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">تقارير محاسبية مبنية على القيود المرحّلة.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="trial" className="space-y-4">
          <TabsList>
            <TabsTrigger value="trial">ميزان المراجعة</TabsTrigger>
            <TabsTrigger value="income">قائمة الدخل</TabsTrigger>
            <TabsTrigger value="balance">المركز المالي</TabsTrigger>
          </TabsList>

          <TabsContent value="trial">
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="font-display text-lg">ميزان المراجعة</CardTitle></CardHeader>
              <CardContent className="p-0">
                {trialBalance.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">لا توجد حركات بعد.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-right font-medium">الكود</th>
                        <th className="px-4 py-3 text-right font-medium">الحساب</th>
                        <th className="px-4 py-3 text-end font-medium">إجمالي مدين</th>
                        <th className="px-4 py-3 text-end font-medium">إجمالي دائن</th>
                        <th className="px-4 py-3 text-end font-medium">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {trialBalance.map((b) => (
                        <tr key={b.account.id}>
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">{b.account.code}</td>
                          <td className="px-4 py-2.5">{b.account.name}</td>
                          <td className="px-4 py-2.5 text-end tabular-nums">{b.debit.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-end tabular-nums">{b.credit.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-end tabular-nums font-semibold">{b.balance.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/40 font-bold">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-end">الإجمالي</td>
                        <td className="px-4 py-3 text-end tabular-nums">{trialBalance.reduce((s, b) => s + b.debit, 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-end tabular-nums">{trialBalance.reduce((s, b) => s + b.credit, 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income">
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="font-display text-lg">قائمة الدخل</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <ReportSection title="الإيرادات" type="revenue" balances={balances} />
                <ReportSection title="المصروفات" type="expense" balances={balances} />
                <div className="flex items-center justify-between border-t-2 border-foreground pt-3">
                  <span className="font-display text-lg font-bold">صافي {netIncome >= 0 ? "الربح" : "الخسارة"}</span>
                  <span className={`font-display text-lg font-bold tabular-nums ${netIncome >= 0 ? "text-success" : "text-destructive"}`}>
                    {Math.abs(netIncome).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance">
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="font-display text-lg">المركز المالي</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <ReportSection title="الأصول" type="asset" balances={balances} />
                <div className="border-t border-border pt-4 space-y-6">
                  <ReportSection title="الخصوم" type="liability" balances={balances} />
                  <ReportSection title="حقوق الملكية" type="equity" balances={balances} />
                  <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                    <span className="text-muted-foreground">صافي الدخل المرحّل</span>
                    <span className="tabular-nums font-medium">{netIncome.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between border-t-2 border-foreground pt-3">
                    <span className="font-display text-lg font-bold">إجمالي الخصوم وحقوق الملكية</span>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {(totalsByType.liability + totalsByType.equity + netIncome).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

const ReportSection = ({
  title, type, balances,
}: { title: string; type: AccountType; balances: AccountBalance[] }) => {
  const items = balances.filter((b) => b.account.account_type === type && b.balance !== 0);
  const total = items.reduce((s, i) => s + i.balance, 0);
  return (
    <div>
      <h3 className="font-display font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">
        {title} ({ACCOUNT_TYPE_LABELS_AR[type]})
      </h3>
      <div className="space-y-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">لا توجد بنود</p>
        ) : items.map((i) => (
          <div key={i.account.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-foreground">
              <span className="font-mono text-xs text-muted-foreground ms-2">{i.account.code}</span>
              {i.account.name_ar}
            </span>
            <span className="tabular-nums">{i.balance.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border mt-2 pt-2">
        <span className="font-medium">إجمالي {title}</span>
        <span className="font-bold tabular-nums">{total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};

export default Reports;
