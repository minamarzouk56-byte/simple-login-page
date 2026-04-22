import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Order, OrderType, Product, Customer, Supplier, OrderLine } from "@/lib/finhub-types";
import { ORDER_TYPE_LABELS_AR } from "@/lib/finhub-types";

interface LineDraft {
  id?: string;
  product_id: string;
  quantity: string;
  unit_price: string; // sale only
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultType: OrderType;
  editing?: Order | null;
}

const blank = (): LineDraft => ({ product_id: "", quantity: "1", unit_price: "0", notes: "" });

export const OrderFormDialog = ({ open, onClose, onSaved, defaultType, editing }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isPurchase = (editing?.order_type ?? defaultType) === "purchase" || (editing?.order_type ?? defaultType) === "sale_return";
  const orderType: OrderType = editing?.order_type ?? defaultType;

  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Array<Customer | Supplier>>([]);
  const [partnerId, setPartnerId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blank()]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const partnerTable = isPurchase ? "suppliers" : "customers";
      const [p, pt] = await Promise.all([
        supabase.from("items").select("*").eq("is_active", true).order("code"),
        supabase.from(partnerTable).select("*").eq("is_active", true).order("name"),
      ]);
      setProducts((p.data ?? []) as Product[]);
      setPartners((pt.data ?? []) as Array<Customer | Supplier>);

      if (editing) {
        setPartnerId(isPurchase ? (editing.supplier_id ?? "") : (editing.customer_id ?? ""));
        setOrderDate(editing.order_date);
        setNotes(editing.notes ?? "");
        const lr = await supabase.from("order_lines").select("*").eq("order_id", editing.id).order("line_order");
        const ls = ((lr.data ?? []) as OrderLine[]).map((l) => ({
          id: l.id,
          product_id: l.product_id,
          quantity: String(l.quantity),
          unit_price: String(l.unit_price),
          notes: l.notes ?? "",
        }));
        setLines(ls.length ? ls : [blank()]);
      } else {
        setPartnerId("");
        setOrderDate(new Date().toISOString().slice(0, 10));
        setNotes("");
        setLines([blank()]);
      }
    })();
  }, [open, isPurchase, editing]);

  const productOpts = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name, prefix: p.code })),
    [products],
  );
  const partnerOpts = useMemo(
    () => partners.map((p) => ({ value: p.id, label: p.name, prefix: p.code })),
    [partners],
  );

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blank()]);
  const removeLine = (i: number) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));

  const submit = async () => {
    if (!partnerId) {
      toast({ title: isPurchase ? "اختر مورد" : "اختر عميل", variant: "destructive" });
      return;
    }
    const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ title: "أضف سطر واحد على الأقل", variant: "destructive" });
      return;
    }
    setSaving(true);

    // partner -> account
    const partner = partners.find((p) => p.id === partnerId);
    const account_id = partner?.account_id ?? null;

    let orderId = editing?.id ?? null;

    if (editing) {
      const { error } = await supabase
        .from("orders")
        .update({
          order_date: orderDate,
          customer_id: isPurchase ? null : partnerId,
          supplier_id: isPurchase ? partnerId : null,
          counterparty_account_id: account_id,
          notes: notes.trim() || null,
        })
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast({ title: "فشل تعديل الطلب", description: error.message, variant: "destructive" });
        return;
      }
      // wipe lines and re-insert (only if still draft/pending)
      await supabase.from("order_lines").delete().eq("order_id", editing.id);
    } else {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          order_number: "",
          order_type: orderType,
          order_date: orderDate,
          customer_id: isPurchase ? null : partnerId,
          supplier_id: isPurchase ? partnerId : null,
          counterparty_account_id: account_id,
          notes: notes.trim() || null,
          status: "pending",
          created_by: user!.id,
        } as never)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast({ title: "فشل إنشاء الطلب", description: error?.message, variant: "destructive" });
        return;
      }
      orderId = (data as { id: string }).id;
    }

    const linesPayload = validLines.map((l, i) => ({
      order_id: orderId!,
      product_id: l.product_id,
      quantity: Number(l.quantity),
      unit_price: isPurchase ? 0 : Number(l.unit_price) || 0,
      unit_cost: 0,
      line_total: isPurchase ? 0 : Number(l.quantity) * (Number(l.unit_price) || 0),
      notes: l.notes.trim() || null,
      line_order: i,
    }));
    const ins = await supabase.from("order_lines").insert(linesPayload as never);

    setSaving(false);
    if (ins.error) {
      toast({ title: "فشل حفظ السطور", description: ins.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم التعديل" : "تم إنشاء الطلب" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "تعديل" : "إنشاء"} {ORDER_TYPE_LABELS_AR[orderType]}
          </DialogTitle>
          <DialogDescription>
            حدد {isPurchase ? "المورد" : "العميل"} والأصناف. التكلفة والمخزن يُحددوا لاحقاً عند الاعتماد.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{isPurchase ? "المورد" : "العميل"} *</Label>
            <SearchableSelect
              value={partnerId}
              onChange={setPartnerId}
              options={partnerOpts}
              placeholder={isPurchase ? "اختر مورد" : "اختر عميل"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الطلب</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">السطور</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4" />إضافة سطر
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead className="w-32">الكمية</TableHead>
                {!isPurchase && <TableHead className="w-32">سعر البيع</TableHead>}
                <TableHead>ملاحظة</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <SearchableSelect
                      value={l.product_id}
                      onChange={(v) => updateLine(i, { product_id: v })}
                      options={productOpts}
                      placeholder="اختر منتج"
                    />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                  </TableCell>
                  {!isPurchase && (
                    <TableCell>
                      <Input type="number" step="0.01" value={l.unit_price}
                        onChange={(e) => updateLine(i, { unit_price: e.target.value })} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Input value={l.notes} onChange={(e) => updateLine(i, { notes: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => removeLine(i)} disabled={lines.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1.5">
          <Label>ملاحظات</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
