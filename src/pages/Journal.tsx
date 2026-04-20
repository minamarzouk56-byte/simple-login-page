import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, BookOpen, Trash2, X } from "lucide-react";
import type { Account, JournalEntry, JournalEntryLine, Partner, Currency } from "@/lib/finhub-types";

interface LineDraft {
  account_id: string;
  partner_id: string | null;
  description: string;
  debit: string;
  credit: string;
}

const Journal = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<(JournalEntry & { lines?: JournalEntryLine[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canCreate = hasPermission("journal.create");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast({ title: "فشل التحميل", description: error.message, variant: "destructive" });
    setEntries((data ?? []) as JournalEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> القيود اليومية
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">سجل القيود المحاسبية. كل قيد متوازن (مدين = دائن) ويترحّل فوراً.</p>
        </div>
        {canCreate && <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> قيد جديد</Button>}
      </header>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">لا توجد قيود بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الرقم</th>
                    <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                    <th className="px-4 py-3 text-right font-medium">الوصف</th>
                    <th className="px-4 py-3 text-right font-medium">المرجع</th>
                    <th className="px-4 py-3 text-end font-medium">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-base">
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">{e.entry_number}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{e.entry_date}</td>
                      <td className="px-4 py-3">{e.description ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-end tabular-nums font-medium">
                        {Number(e.total_debit).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <NewJournalDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={load} />
    </div>
  );
};

const NewJournalDialog = ({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) => {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [lines, setLines] = useState<LineDraft[]>([
    { account_id: "", partner_id: null, description: "", debit: "", credit: "" },
    { account_id: "", partner_id: null, description: "", debit: "", credit: "" },
  ]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("accounts").select("*").eq("is_active", true).eq("is_leaf", true).order("code"),
      supabase.from("partners").select("*").eq("is_active", true).order("name_ar"),
      supabase.from("currencies").select("*").order("code"),
    ]).then(([a, p, c]) => {
      setAccounts((a.data ?? []) as Account[]);
      setPartners((p.data ?? []) as Partner[]);
      setCurrencies((c.data ?? []) as Currency[]);
    });
  }, [open]);

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setReference("");
      setCurrency("EGP");
      setLines([
        { account_id: "", partner_id: null, description: "", debit: "", credit: "" },
        { account_id: "", partner_id: null, description: "", debit: "", credit: "" },
      ]);
    }
  }, [open]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((p) => [...p, { account_id: "", partner_id: null, description: "", debit: "", credit: "" }]);
  const removeLine = (idx: number) => setLines((p) => (p.length > 2 ? p.filter((_, i) => i !== idx) : p));

  const handleSave = async () => {
    if (!totals.balanced) {
      toast({ title: "القيد غير متوازن", description: "إجمالي المدين يجب أن يساوي إجمالي الدائن وأكبر من صفر.", variant: "destructive" });
      return;
    }
    const validLines = lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) {
      toast({ title: "أدخل سطرين على الأقل", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: entry, error: entryErr } = await supabase
      .from("journal_entries")
      .insert({
        entry_date: date,
        description: description.trim() || null,
        reference: reference.trim() || null,
        currency_code: currency,
        status: "posted",
      } as never)
      .select()
      .single();
    if (entryErr || !entry) {
      setSaving(false);
      toast({ title: "فشل إنشاء القيد", description: entryErr?.message, variant: "destructive" });
      return;
    }
    const linesPayload = validLines.map((l, i) => ({
      entry_id: (entry as JournalEntry).id,
      account_id: l.account_id,
      partner_id: l.partner_id,
      description: l.description.trim() || null,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      currency_code: currency,
      line_order: i,
    }));
    const { error: linesErr } = await supabase.from("journal_entry_lines").insert(linesPayload as never);
    setSaving(false);
    if (linesErr) {
      toast({ title: "فشل حفظ السطور", description: linesErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم ترحيل القيد بنجاح" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">قيد يومية جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>المرجع (اختياري)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="رقم الفاتورة، إلخ" />
            </div>
            <div className="space-y-2">
              <Label>العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-3 space-y-2">
              <Label>الوصف</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="بيان القيد" />
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-right font-medium w-[28%]">الحساب</th>
                  <th className="px-2 py-2 text-right font-medium w-[18%]">الطرف</th>
                  <th className="px-2 py-2 text-right font-medium">البيان</th>
                  <th className="px-2 py-2 text-end font-medium w-[14%]">مدين</th>
                  <th className="px-2 py-2 text-end font-medium w-[14%]">دائن</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5">
                      <Select value={line.account_id} onValueChange={(v) => updateLine(idx, { account_id: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="اختر حساب" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="font-mono text-xs ms-2">{a.code}</span> {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1.5">
                      <Select value={line.partner_id ?? "__none"} onValueChange={(v) => updateLine(idx, { partner_id: v === "__none" ? null : v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— بدون —</SelectItem>
                          {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1.5">
                      <Input className="h-9" value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                    </td>
                    <td className="p-1.5">
                      <Input
                        className="h-9 text-end tabular-nums"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(idx, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        className="h-9 text-end tabular-nums"
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(idx, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
                      />
                    </td>
                    <td className="p-1">
                      <Button variant="ghost" size="sm" disabled={lines.length <= 2} onClick={() => removeLine(idx)} className="h-8 w-8 p-0">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 text-end">الإجماليات</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{totals.debit.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{totals.credit.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-end text-xs">
                    {totals.balanced ? (
                      <span className="text-success">✓ القيد متوازن</span>
                    ) : (
                      <span className="text-destructive">
                        فرق: {Math.abs(totals.debit - totals.credit).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Button variant="outline" size="sm" onClick={addLine} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> إضافة سطر
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || !totals.balanced}>
            {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            ترحيل القيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Journal;
