import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FilePlus2, Loader2, Plus, Trash2, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import type { InventoryItem, Warehouse, PermitType } from "@/lib/finhub-types";
import { fmtNumber } from "@/components/inventory/inventory-lib";

interface AccountOpt { id: string; code: string; name: string; }
interface LineDraft {
  uid: string;
  item_id: string;
  quantity: string;
  unit_price: string;
  notes: string;
}

const newLine = (): LineDraft => ({
  uid: crypto.randomUUID(),
  item_id: "",
  quantity: "1",
  unit_price: "0",
  notes: "",
});

const InventoryNewRequest = () => {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canRequest = hasPermission("inventory.request");

  const [permitType, setPermitType] = useState<PermitType>("issue");
  const [permitDate, setPermitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("items").select("*").eq("is_active", true).order("code"),
      supabase.from("warehouses").select("*").eq("is_active", true).order("code"),
      supabase.from("accounts").select("id, code, name, is_active").eq("is_active", true).order("code"),
    ]).then(([it, wh, ac]) => {
      setItems((it.data ?? []) as InventoryItem[]);
      setWarehouses((wh.data ?? []) as Warehouse[]);
      setAccounts((ac.data ?? []) as AccountOpt[]);
    });
  }, []);

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  );

  const updateLine = (uid: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  };

  const removeLine = (uid: string) => setLines((prev) => prev.filter((l) => l.uid !== uid));

  const onPickItem = (uid: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    updateLine(uid, {
      item_id: itemId,
      unit_price: item ? String(permitType === "receive" ? item.cost_price : item.sale_price) : "0",
    });
  };

  // when permit type toggles, recompute unit prices
  useEffect(() => {
    setLines((prev) => prev.map((l) => {
      if (!l.item_id) return l;
      const item = items.find((i) => i.id === l.item_id);
      if (!item) return l;
      return { ...l, unit_price: String(permitType === "receive" ? item.cost_price : item.sale_price) };
    }));
  }, [permitType, items]);

  const submit = async () => {
    if (!canRequest) return;
    if (!warehouseId) { toast({ title: "اختر المخزن", variant: "destructive" }); return; }
    if (!counterpartyId) { toast({ title: "اختر الحساب المقابل", variant: "destructive" }); return; }
    const valid = lines.filter((l) => l.item_id && Number(l.quantity) > 0);
    if (valid.length === 0) { toast({ title: "أضف صنفاً واحداً على الأقل", variant: "destructive" }); return; }

    setSaving(true);
    const { data: permit, error } = await supabase
      .from("inventory_permits")
      .insert({
        permit_number: "",
        permit_type: permitType,
        permit_date: permitDate,
        warehouse_id: warehouseId,
        counterparty_account_id: counterpartyId,
        description: description.trim() || null,
        notes: notes.trim() || null,
        total_amount: totalAmount,
        requested_by: user!.id,
      } as never)
      .select("id, permit_number")
      .single();

    if (error || !permit) {
      setSaving(false);
      toast({ title: "فشل إنشاء الطلب", description: error?.message, variant: "destructive" });
      return;
    }

    const linePayload = valid.map((l, idx) => ({
      permit_id: (permit as { id: string }).id,
      item_id: l.item_id,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price) || 0,
      line_total: (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
      notes: l.notes.trim() || null,
      line_order: idx,
    }));
    const { error: linesErr } = await supabase.from("inventory_permit_lines").insert(linePayload as never);
    setSaving(false);
    if (linesErr) {
      toast({ title: "فشل حفظ البنود", description: linesErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال الطلب", description: `رقم الطلب: ${(permit as { permit_number: string }).permit_number}` });
    navigate("/inventory/requests");
  };

  if (!canRequest) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        ليس لديك صلاحية تقديم طلبات إذن.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <FilePlus2 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">طلب إذن جديد</h1>
          <p className="text-sm text-muted-foreground">إنشاء طلب إذن صرف أو وارد للمخزن.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>بيانات الطلب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>نوع الإذن</Label>
            <RadioGroup
              value={permitType}
              onValueChange={(v) => setPermitType(v as PermitType)}
              className="flex gap-3"
            >
              <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-base ${permitType === "issue" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="issue" />
                <ArrowUpFromLine className="h-4 w-4" />
                <span>إذن صرف</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-base ${permitType === "receive" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="receive" />
                <ArrowDownToLine className="h-4 w-4" />
                <span>إذن وارد</span>
              </label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={permitDate} onChange={(e) => setPermitDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المخزن *</Label>
              <SearchableSelect
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name, prefix: w.code }))}
                placeholder="اختر مخزناً"
              />
            </div>
            <div className="space-y-1.5">
              <Label>الحساب المقابل *</Label>
              <SearchableSelect
                value={counterpartyId}
                onChange={setCounterpartyId}
                options={accounts.map((a) => ({ value: a.id, label: a.name, prefix: a.code, keywords: a.code }))}
                placeholder={permitType === "receive" ? "حساب المورد/النقدية" : "حساب العميل/المصروف"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>وصف موجز</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="مثلاً: شراء مستلزمات للمحل" />
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>الأصناف</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, newLine()])}>
            <Plus className="h-4 w-4" />إضافة بند
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">الصنف</TableHead>
                <TableHead className="w-[12%]">الكمية</TableHead>
                <TableHead className="w-[15%]">سعر الوحدة</TableHead>
                <TableHead className="w-[15%]">الإجمالي</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const item = items.find((i) => i.id === l.item_id);
                const lineTotal = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                return (
                  <TableRow key={l.uid}>
                    <TableCell>
                      <SearchableSelect
                        value={l.item_id}
                        onChange={(v) => onPickItem(l.uid, v)}
                        options={items.map((i) => ({
                          value: i.id, label: i.name, prefix: i.code,
                          keywords: `${i.code} ${i.unit}`,
                        }))}
                        placeholder="اختر صنفاً"
                      />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" min="0" value={l.quantity}
                        onChange={(e) => updateLine(l.uid, { quantity: e.target.value })} />
                      {item && <div className="text-xs text-muted-foreground mt-1">{item.unit}</div>}
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" min="0" value={l.unit_price}
                        onChange={(e) => updateLine(l.uid, { unit_price: e.target.value })} />
                    </TableCell>
                    <TableCell className="font-mono tabular-nums font-semibold">{fmtNumber(lineTotal)}</TableCell>
                    <TableCell>
                      <Input value={l.notes} onChange={(e) => updateLine(l.uid, { notes: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => removeLine(l.uid)} disabled={lines.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t p-4 bg-muted/30">
            <span className="text-sm text-muted-foreground">الإجمالي</span>
            <span className="font-mono tabular-nums text-lg font-bold">{fmtNumber(totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>إلغاء</Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          إرسال الطلب
        </Button>
      </div>
    </div>
  );
};

export default InventoryNewRequest;
