import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import type { Customer, Account, Currency } from "@/lib/finhub-types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner: Customer | null;
  kind: "customer" | "supplier";
  onSaved: () => void;
}

export const PartnerFormDialog = ({ open, onOpenChange, partner, kind, onSaved }: Props) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [creditLimit, setCreditLimit] = useState("0");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [accountId, setAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [saving, setSaving] = useState(false);

  const table = kind === "customer" ? "customers" : "suppliers";

  // Fetch accounts + currencies once dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: accs }, { data: curs }] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_active", true).order("code"),
        supabase.from("currencies").select("*").order("code"),
      ]);
      setAccounts((accs ?? []) as Account[]);
      setCurrencies((curs ?? []) as Currency[]);
    })();
  }, [open]);

  // Reset/populate fields when opening
  useEffect(() => {
    if (!open) return;
    setName(partner?.name ?? "");
    setPhone(partner?.phone ?? "");
    setEmail(partner?.email ?? "");
    setAddress(partner?.address ?? "");
    setTaxNumber(partner?.tax_number ?? "");
    setCreditLimit(String(partner?.credit_limit ?? 0));
    setOpeningBalance(String(partner?.opening_balance ?? 0));
    setNotes(partner?.notes ?? "");
    setCurrency(partner?.currency ?? "EGP");
    setAccountId(partner?.account_id ?? "");
  }, [open, partner]);

  // Compute leaf accounts (no children) matching currency
  const leafAccountIds = useMemo(() => {
    const parents = new Set(accounts.map((a) => a.parent_id).filter(Boolean) as string[]);
    return new Set(accounts.filter((a) => !parents.has(a.id)).map((a) => a.id));
  }, [accounts]);

  const eligibleAccounts = useMemo(
    () => accounts.filter((a) => leafAccountIds.has(a.id) && a.currency === currency),
    [accounts, leafAccountIds, currency],
  );

  // If currency changes and current account no longer matches, clear it
  useEffect(() => {
    if (!accountId) return;
    const acc = accounts.find((a) => a.id === accountId);
    if (acc && acc.currency !== currency) setAccountId("");
  }, [currency, accountId, accounts]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    if (!accountId) {
      toast({ title: "اختر الحساب المرتبط من شجرة الحسابات", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      tax_number: taxNumber.trim() || null,
      credit_limit: parseFloat(creditLimit) || 0,
      opening_balance: parseFloat(openingBalance) || 0,
      notes: notes.trim() || null,
      currency,
      account_id: accountId,
    };

    const { error } = partner
      ? await supabase.from(table).update(payload).eq("id", partner.id)
      : await supabase.from(table).insert(payload as never);
    setSaving(false);
    if (error) {
      toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: partner ? "تم التعديل" : "تم الإنشاء" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="font-display">
            {partner ? "تعديل البيانات" : kind === "customer" ? "إضافة عميل جديد" : "إضافة مورد جديد"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الكود (يُنشأ تلقائياً)</Label>
              <Input
                value={partner?.code ?? "سيتم التوليد عند الحفظ"}
                disabled
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                العملة <span className="text-destructive">*</span>
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name_ar} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                الحساب المرتبط في شجرة الحسابات <span className="text-destructive">*</span>
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر حساباً فرعياً بنفس العملة..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleAccounts.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      لا توجد حسابات فرعية بعملة {currency}. أنشئ حساباً أولاً.
                    </div>
                  ) : (
                    eligibleAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground me-2">
                          {a.code}
                        </span>
                        {a.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                لازم يكون الحساب فرعي (آخر مستوى) وعملته مطابقة لعملة {kind === "customer" ? "العميل" : "المورد"}.
              </p>
            </div>

            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input dir="ltr" className="text-right" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>العنوان</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الرقم الضريبي</Label>
              <Input dir="ltr" className="text-right" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>حد الائتمان</Label>
              <Input
                dir="ltr"
                className="text-right tabular-nums"
                type="number"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الرصيد الافتتاحي</Label>
              <Input
                dir="ltr"
                className="text-right tabular-nums"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
