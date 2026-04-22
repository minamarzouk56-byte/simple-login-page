import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import type {
  StockRequest, StockRequestLine, Product, Batch, Warehouse,
  Customer, Supplier,
} from "@/lib/finhub-types";
import { STOCK_REQUEST_TYPE_LABELS_AR } from "@/lib/finhub-types";
import { fmtNumber, fmtQty } from "@/lib/inventory-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  request: StockRequest;
}

interface AllocRow {
  batch_id: string;
  quantity: string;
}

/**
 * Settle dialog handles all 4 request types:
 * - add: pick warehouse + per-line cost + per-line price (no batch allocation - creates pending purchase order)
 * - issue: per-line price + per-line batch allocation
 * - sale_return: per-line refund price + per-line batch allocation (returns to that batch)
 * - purchase_return: per-line batch allocation (deducts from that batch)
 */
export const SettleStockRequestDialog = ({ open, onClose, onDone, request }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lines, setLines] = useState<StockRequestLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [partner, setPartner] = useState<Customer | Supplier | null>(null);

  // For 'add' requests: warehouse + cost/price per line
  const [warehouseId, setWarehouseId] = useState("");
  const [lineCosts, setLineCosts] = useState<Record<string, string>>({});
  const [linePrices, setLinePrices] = useState<Record<string, string>>({});

  // For batch allocation (issue/returns)
  const [allocs, setAllocs] = useState<Record<string, AllocRow[]>>({});

  const isAdd = request.request_type === "add";
  const needsAllocation = request.request_type !== "add";
  const needsSalePrice = request.request_type === "issue" || request.request_type === "sale_return";

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [l, p, b, w] = await Promise.all([
        supabase.from("stock_request_lines").select("*").eq("request_id", request.id).order("line_order"),
        supabase.from("items").select("*"),
        supabase.from("batches").select("*").gt("remaining_quantity", 0).order("created_at"),
        supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
      ]);
      const ll = (l.data ?? []) as StockRequestLine[];
      const pp = (p.data ?? []) as Product[];
      setLines(ll);
      setProducts(pp);
      setBatches((b.data ?? []) as Batch[]);
      setWarehouses((w.data ?? []) as Warehouse[]);

      // load partner
      if (request.customer_id) {
        const { data } = await supabase.from("customers").select("*").eq("id", request.customer_id).maybeSingle();
        setPartner((data as Customer) ?? null);
      } else if (request.supplier_id) {
        const { data } = await supabase.from("suppliers").select("*").eq("id", request.supplier_id).maybeSingle();
        setPartner((data as Supplier) ?? null);
      }

      // init prices for needsSalePrice: default = product sale_price
      const prices: Record<string, string> = {};
      const costs: Record<string, string> = {};
      ll.forEach((line) => {
        const prod = pp.find((x) => x.id === line.product_id);
        if (needsSalePrice) {
          prices[line.id] = String(prod?.sale_price ?? 0);
        }
        if (isAdd) {
          costs[line.id] = "0";
          prices[line.id] = String(prod?.sale_price ?? 0);
        }
      });
      setLinePrices(prices);
      setLineCosts(costs);

      // init FIFO allocations for needsAllocation
      if (needsAllocation) {
        const map: Record<string, AllocRow[]> = {};
        const used: Record<string, number> = {};
        ll.forEach((line) => {
          let need = Number(line.quantity);
          const productBatches = ((b.data ?? []) as Batch[])
            .filter((bt) => bt.product_id === line.product_id)
            .sort((a, c) => new Date(a.created_at).getTime() - new Date(c.created_at).getTime());
          const rows: AllocRow[] = [];
          for (const bt of productBatches) {
            if (need <= 0) break;
            const avail = Number(bt.remaining_quantity) - (used[bt.id] || 0);
            if (avail <= 0) continue;
            const take = Math.min(avail, need);
            rows.push({ batch_id: bt.id, quantity: String(take) });
            used[bt.id] = (used[bt.id] || 0) + take;
            need -= take;
          }
          map[line.id] = rows.length ? rows : [{ batch_id: "", quantity: "0" }];
        });
        setAllocs(map);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request.id]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w.name])), [warehouses]);

  const batchesFor = (productId: string) =>
    batches.filter((b) => b.product_id === productId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const updateAlloc = (lineId: string, idx: number, patch: Partial<AllocRow>) =>
    setAllocs((s) => ({
      ...s,
      [lineId]: s[lineId].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  const addAlloc = (lineId: string) =>
    setAllocs((s) => ({ ...s, [lineId]: [...(s[lineId] ?? []), { batch_id: "", quantity: "0" }] }));
  const removeAlloc = (lineId: string, idx: number) =>
    setAllocs((s) => ({ ...s, [lineId]: s[lineId].filter((_, i) => i !== idx) }));
  const lineAllocated = (lineId: string) =>
    (allocs[lineId] ?? []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  const submit = async () => {
    setSaving(true);

    try {
      if (isAdd) {
        if (!warehouseId) {
          toast({ title: "اختر المخزن", variant: "destructive" });
          setSaving(false);
          return;
        }
        for (const line of lines) {
          if (Number(lineCosts[line.id] || 0) <= 0) {
            toast({ title: "حدد تكلفة الوحدة لكل بند", variant: "destructive" });
            setSaving(false);
            return;
          }
        }
        const { error } = await supabase.rpc("settle_add_request", {
          _request_id: request.id,
          _warehouse_id: warehouseId,
          _line_costs: lineCosts as never,
          _line_prices: linePrices as never,
        });
        if (error) throw error;
        toast({ title: "تم إنشاء فاتورة الشراء بحالة قيد الفوترة" });
      } else {
        // validate allocations
        for (const line of lines) {
          const sum = lineAllocated(line.id);
          if (Math.abs(sum - Number(line.quantity)) > 0.0001) {
            toast({
              title: "تخصيص غير مكتمل",
              description: `${productMap.get(line.product_id)?.name}: مطلوب ${line.quantity}، مخصص ${sum}`,
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
        }

        const payload: { line_id: string; batch_id: string; quantity: number }[] = [];
        Object.entries(allocs).forEach(([line_id, rows]) => {
          rows.forEach((r) => {
            if (r.batch_id && Number(r.quantity) > 0) {
              payload.push({ line_id, batch_id: r.batch_id, quantity: Number(r.quantity) });
            }
          });
        });

        if (request.request_type === "issue") {
          for (const line of lines) {
            if (Number(linePrices[line.id] || 0) <= 0) {
              toast({ title: "حدد سعر البيع لكل بند", variant: "destructive" });
              setSaving(false);
              return;
            }
          }
          const { error } = await supabase.rpc("settle_issue_request", {
            _request_id: request.id,
            _allocations: payload as never,
            _line_prices: linePrices as never,
          });
          if (error) throw error;
          toast({ title: "تم إنشاء فاتورة البيع بحالة قيد الفوترة" });
        } else if (request.request_type === "sale_return") {
          for (const line of lines) {
            if (Number(linePrices[line.id] || 0) <= 0) {
              toast({ title: "حدد سعر الإرجاع لكل بند", variant: "destructive" });
              setSaving(false);
              return;
            }
          }
          const { error } = await supabase.rpc("settle_sale_return_request", {
            _request_id: request.id,
            _allocations: payload as never,
            _line_prices: linePrices as never,
          });
          if (error) throw error;
          toast({ title: "تم تسوية مرتجع المبيعات وإنشاء القيد" });
        } else if (request.request_type === "purchase_return") {
          const { error } = await supabase.rpc("settle_purchase_return_request", {
            _request_id: request.id,
            _allocations: payload as never,
          });
          if (error) throw error;
          toast({ title: "تم تسوية مرتجع المشتريات وإنشاء القيد" });
        }
      }

      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ غير معروف";
      toast({ title: "فشل التسوية", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const partnerLabel = partner ? `${partner.code} - ${partner.name}` : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية الطلب — {request.request_number}</DialogTitle>
          <DialogDescription>
            {STOCK_REQUEST_TYPE_LABELS_AR[request.request_type]} — الطرف: {partnerLabel}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {(request.request_type === "add" || request.request_type === "issue") && (
              <div className="rounded-md bg-muted/50 border p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {request.request_type === "add"
                    ? "بعد التسوية ستُنشأ فاتورة شراء بحالة قيد الفوترة. لن يتم تحديث المخزون أو الحسابات تلقائياً."
                    : "بعد التسوية ستُنشأ فاتورة بيع بحالة قيد الفوترة. لن يتم تحديث المخزون أو الحسابات تلقائياً."}
                </span>
              </div>
            )}
            {(request.request_type === "sale_return" || request.request_type === "purchase_return") && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-sm">
                التسوية ستؤثر فوراً على المخزون والدُفعات وحساب الطرف، وسيُنشأ قيد محاسبي تلقائياً.
              </div>
            )}

            {isAdd && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>المخزن المستلم *</Label>
                  <SearchableSelect
                    value={warehouseId}
                    onChange={setWarehouseId}
                    options={warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` }))}
                    placeholder="اختر مخزن"
                  />
                </div>
              </div>
            )}

            {/* Lines */}
            {lines.map((line) => {
              const p = productMap.get(line.product_id);
              const need = Number(line.quantity);
              return (
                <div key={line.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium">{p?.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p?.code}</div>
                    </div>
                    <Badge variant="outline">المطلوب: {fmtQty(need)} {p?.unit}</Badge>
                  </div>

                  {/* Cost (add only) */}
                  {isAdd && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">تكلفة الوحدة *</Label>
                        <Input type="number" step="0.01" value={lineCosts[line.id] ?? "0"}
                          onChange={(e) => setLineCosts((s) => ({ ...s, [line.id]: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">سعر البيع المقترح</Label>
                        <Input type="number" step="0.01" value={linePrices[line.id] ?? "0"}
                          onChange={(e) => setLinePrices((s) => ({ ...s, [line.id]: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {/* Sale/Return price */}
                  {needsSalePrice && (
                    <div>
                      <Label className="text-xs">
                        {request.request_type === "issue" ? "سعر البيع للوحدة *" : "سعر الإرجاع للوحدة *"}
                      </Label>
                      <Input type="number" step="0.01" value={linePrices[line.id] ?? "0"}
                        onChange={(e) => setLinePrices((s) => ({ ...s, [line.id]: e.target.value }))} />
                      <p className="text-xs text-muted-foreground mt-1">
                        السعر الافتراضي من بطاقة المنتج: {fmtNumber(p?.sale_price ?? 0)}
                      </p>
                    </div>
                  )}

                  {/* Batch allocation */}
                  {needsAllocation && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">
                          {request.request_type === "sale_return" ? "الدُفعة التي سيُرجَع لها" :
                           request.request_type === "purchase_return" ? "الدُفعة التي سيُخصم منها" :
                           "الدُفعة التي سيُصرف منها"}
                        </Label>
                        <Badge variant={Math.abs(lineAllocated(line.id) - need) < 0.0001 ? "default" : "destructive"}>
                          المخصص: {fmtQty(lineAllocated(line.id))}
                        </Badge>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>الدُفعة</TableHead>
                            <TableHead className="text-end">المتاح</TableHead>
                            <TableHead className="text-end">التكلفة</TableHead>
                            <TableHead className="w-32">الكمية</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(allocs[line.id] ?? []).map((row, i) => {
                            const opts = batchesFor(line.product_id);
                            const bt = opts.find((x) => x.id === row.batch_id);
                            return (
                              <TableRow key={i}>
                                <TableCell>
                                  <select value={row.batch_id}
                                    onChange={(e) => updateAlloc(line.id, i, { batch_id: e.target.value })}
                                    className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                                    <option value="">— اختر دُفعة —</option>
                                    {opts.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.display_code ?? "—"} | {whMap.get(b.warehouse_id)} | تكلفة {fmtNumber(Number(b.unit_cost))}
                                      </option>
                                    ))}
                                  </select>
                                </TableCell>
                                <TableCell className="text-end tabular-nums">{bt ? fmtQty(Number(bt.remaining_quantity)) : "—"}</TableCell>
                                <TableCell className="text-end tabular-nums">{bt ? fmtNumber(Number(bt.unit_cost)) : "—"}</TableCell>
                                <TableCell>
                                  <Input type="number" step="0.01" value={row.quantity}
                                    onChange={(e) => updateAlloc(line.id, i, { quantity: e.target.value })} />
                                </TableCell>
                                <TableCell>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                                    onClick={() => removeAlloc(line.id, i)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <Button type="button" variant="outline" size="sm" onClick={() => addAlloc(line.id)}>
                        <Plus className="h-4 w-4" />دُفعة أخرى
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}تأكيد التسوية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
