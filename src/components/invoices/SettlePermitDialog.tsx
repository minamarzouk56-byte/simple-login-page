import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Receipt } from "lucide-react";
import { fmtNumber } from "@/components/inventory/inventory-lib";
import type { InventoryPermit, InventoryPermitLine, InventoryItem, PermitType } from "@/lib/finhub-types";

interface Props {
  permit: InventoryPermit | null;
  onClose: () => void;
  onSettled: () => void;
}

const defaultPriceField = (t: PermitType): "sale_price" | "cost_price" =>
  t === "issue" || t === "purchase_return" ? "sale_price" : "cost_price";

export const SettlePermitDialog = ({ permit, onClose, onSettled }: Props) => {
  const { toast } = useToast();
  const [lines, setLines] = useState<InventoryPermitLine[]>([]);
  const [items, setItems] = useState<Map<string, InventoryItem>>(new Map());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [taxPercent, setTaxPercent] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!permit) return;
    setLoading(true);
    (async () => {
      const [{ data: ls }, { data: its }] = await Promise.all([
        supabase.from("inventory_permit_lines").select("*").eq("permit_id", permit.id).order("line_order"),
        supabase.from("items").select("*"),
      ]);
      const lineRows = (ls ?? []) as InventoryPermitLine[];
      const itemList = (its ?? []) as InventoryItem[];
      const itemMap = new Map(itemList.map((i) => [i.id, i]));
      setLines(lineRows);
      setItems(itemMap);
      const field = defaultPriceField(permit.permit_type);
      const initial: Record<string, number> = {};
      lineRows.forEach((l) => {
        const it = itemMap.get(l.item_id);
        initial[l.id] = l.unit_price > 0 ? Number(l.unit_price) : Number(it?.[field] ?? 0);
      });
      setPrices(initial);
      setTaxPercent(0);
      setDiscount(0);
      setNotes("");
      setLoading(false);
    })();
  }, [permit]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity) * (prices[l.id] ?? 0), 0),
    [lines, prices],
  );
  const taxAmt = useMemo(() => Math.round(subtotal * taxPercent) / 100, [subtotal, taxPercent]);
  const total = useMemo(() => subtotal + taxAmt - discount, [subtotal, taxAmt, discount]);

  const submit = async () => {
    if (!permit) return;
    if (lines.some((l) => !prices[l.id] || prices[l.id] <= 0)) {
      toast({ title: "أكمل التسعير", description: "يجب إدخال سعر صحيح لكل صنف", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const linePrices: Record<string, number> = {};
    lines.forEach((l) => { linePrices[l.item_id] = prices[l.id]; });
    const { error } = await supabase.rpc("create_invoice_request_from_permit", {
      _permit_id: permit.id,
      _tax_percent: taxPercent,
      _discount_amount: discount,
      _line_prices: linePrices,
      _notes: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "فشل إنشاء طلب الفاتورة", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إنشاء طلب الفاتورة", description: "انتقل إلى صفحة طلبات الفواتير لإكمال التأكيد." });
    onSettled();
    onClose();
  };

  return (
    <Dialog open={!!permit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            تسوية الإذن {permit?.permit_number}
          </DialogTitle>
          <DialogDescription>
            راجع الأسعار وأضف الضريبة/الخصم لإنشاء طلب فاتورة
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر الوحدة</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const it = items.get(l.item_id);
                    const price = prices[l.id] ?? 0;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{it?.name ?? "—"}</div>
                          <div className="font-mono text-xs text-muted-foreground">{it?.code}</div>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {fmtNumber(l.quantity)} <span className="text-xs text-muted-foreground">{it?.unit}</span>
                        </TableCell>
                        <TableCell className="w-40">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={price}
                            onChange={(e) => setPrices((p) => ({ ...p, [l.id]: Number(e.target.value) }))}
                            className="h-9 font-mono"
                          />
                        </TableCell>
                        <TableCell className="font-mono tabular-nums font-semibold">
                          {fmtNumber(Number(l.quantity) * price)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>نسبة الضريبة %</Label>
                <Input
                  type="number" step="0.01" min="0" value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value))} className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>قيمة الخصم</Label>
                <Input
                  type="number" step="0.01" min="0" value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))} className="font-mono"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">الإجمالي قبل الضريبة:</span><span className="font-mono tabular-nums">{fmtNumber(subtotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">الضريبة:</span><span className="font-mono tabular-nums">{fmtNumber(taxAmt)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">الخصم:</span><span className="font-mono tabular-nums">- {fmtNumber(discount)}</span></div>
              <div className="flex items-center justify-between border-t pt-1.5 font-bold"><span>الإجمالي النهائي:</span><span className="font-mono tabular-nums text-lg text-primary">{fmtNumber(total)}</span></div>
            </div>

            <div className="space-y-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting || loading}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            إنشاء طلب فاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
