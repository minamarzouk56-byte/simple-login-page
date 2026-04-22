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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import type { Order, OrderLine, Product, Warehouse } from "@/lib/finhub-types";
import { fmtNumber } from "@/lib/inventory-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  order: Order;
}

export const PurchaseApproveDialog = ({ open, onClose, onDone, order }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [taxPercent, setTaxPercent] = useState(String(order.tax_percent ?? 0));
  const [discount, setDiscount] = useState(String(order.discount_amount ?? 0));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [w, p, l] = await Promise.all([
        supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
        supabase.from("items").select("*"),
        supabase.from("order_lines").select("*").eq("order_id", order.id).order("line_order"),
      ]);
      setWarehouses((w.data ?? []) as Warehouse[]);
      setProducts((p.data ?? []) as Product[]);
      const ll = (l.data ?? []) as OrderLine[];
      setLines(ll);
      const init: Record<string, string> = {};
      ll.forEach((x) => { init[x.id] = String(x.unit_cost || 0); });
      setCosts(init);
      setLoading(false);
    })();
  }, [open, order.id]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(costs[l.id] || 0) * Number(l.quantity)), 0),
    [lines, costs],
  );
  const taxAmt = useMemo(() => (subtotal * (Number(taxPercent) || 0)) / 100, [subtotal, taxPercent]);
  const total = useMemo(() => subtotal + taxAmt - (Number(discount) || 0), [subtotal, taxAmt, discount]);

  const submit = async () => {
    if (!warehouseId) {
      toast({ title: "اختر مخزن", variant: "destructive" });
      return;
    }
    if (lines.some((l) => !(Number(costs[l.id]) > 0))) {
      toast({ title: "أدخل تكلفة لكل سطر", variant: "destructive" });
      return;
    }
    setSaving(true);
    const lineCosts: Record<string, number> = {};
    Object.entries(costs).forEach(([k, v]) => { lineCosts[k] = Number(v) || 0; });
    const { error } = await supabase.rpc("approve_purchase_order", {
      _order_id: order.id,
      _warehouse_id: warehouseId,
      _line_costs: lineCosts as never,
      _tax_percent: Number(taxPercent) || 0,
      _discount_amount: Number(discount) || 0,
      _notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "فشل الاعتماد", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم اعتماد الطلب وإنشاء الدُفعات والقيد" });
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>اعتماد طلب الشراء — {order.order_number}</DialogTitle>
          <DialogDescription>حدد المخزن وتكلفة كل صنف. سيتم إنشاء الدُفعات والقيد المحاسبي.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>المخزن المستلم *</Label>
              <SearchableSelect
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name, prefix: w.code }))}
                placeholder="اختر مخزن"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="text-end w-24">الكمية</TableHead>
                  <TableHead className="w-40">تكلفة الوحدة *</TableHead>
                  <TableHead className="text-end w-32">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => {
                  const p = productMap.get(l.product_id);
                  const cost = Number(costs[l.id] || 0);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{p?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p?.code}</div>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{fmtNumber(Number(l.quantity))} {p?.unit}</TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={costs[l.id] ?? ""}
                          onChange={(e) => setCosts({ ...costs, [l.id]: e.target.value })} />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{fmtNumber(cost * Number(l.quantity))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>نسبة الضريبة %</Label>
                <Input type="number" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>الخصم</Label>
                <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ملاحظات الاعتماد</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>الإجمالي قبل الضريبة:</span><span className="tabular-nums font-medium">{fmtNumber(subtotal)}</span></div>
              <div className="flex justify-between"><span>الضريبة:</span><span className="tabular-nums">{fmtNumber(taxAmt)}</span></div>
              <div className="flex justify-between"><span>الخصم:</span><span className="tabular-nums">- {fmtNumber(Number(discount) || 0)}</span></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t"><span>الإجمالي النهائي:</span><span className="tabular-nums text-primary">{fmtNumber(total)}</span></div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}اعتماد ونشر القيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
