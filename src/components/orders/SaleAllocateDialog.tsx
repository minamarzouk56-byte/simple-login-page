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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import type { Order, OrderLine, Product, Batch, Warehouse } from "@/lib/finhub-types";
import { fmtNumber } from "@/lib/inventory-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  order: Order;
}

interface AllocRow {
  batch_id: string;
  quantity: string;
}

export const SaleAllocateDialog = ({ open, onClose, onDone, order }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  /** allocations[lineId] = AllocRow[] */
  const [allocs, setAllocs] = useState<Record<string, AllocRow[]>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [l, p, b, w] = await Promise.all([
        supabase.from("order_lines").select("*").eq("order_id", order.id).order("line_order"),
        supabase.from("items").select("*"),
        supabase.from("batches").select("*").gt("remaining_quantity", 0).order("created_at"), // FIFO
        supabase.from("warehouses").select("*"),
      ]);
      const ll = (l.data ?? []) as OrderLine[];
      setLines(ll);
      setProducts((p.data ?? []) as Product[]);
      setBatches((b.data ?? []) as Batch[]);
      setWarehouses((w.data ?? []) as Warehouse[]);

      // fetch existing allocations if already allocated
      if (order.status === "allocated") {
        const olbR = await supabase
          .from("order_line_batches")
          .select("*")
          .in("order_line_id", ll.map((x) => x.id));
        const map: Record<string, AllocRow[]> = {};
        ((olbR.data ?? []) as { order_line_id: string; batch_id: string; quantity: number }[])
          .forEach((r) => {
            (map[r.order_line_id] ||= []).push({ batch_id: r.batch_id, quantity: String(r.quantity) });
          });
        setAllocs(map);
      } else {
        // FIFO defaults
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
  }, [open, order.id, order.status]);

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
    // validate
    for (const line of lines) {
      const sum = lineAllocated(line.id);
      if (Math.abs(sum - Number(line.quantity)) > 0.0001) {
        toast({
          title: "تخصيص غير مكتمل",
          description: `السطر ${productMap.get(line.product_id)?.name}: مطلوب ${line.quantity}، مخصص ${sum}`,
          variant: "destructive",
        });
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
    setSaving(true);
    const { error } = await supabase.rpc("allocate_sale_order", {
      _order_id: order.id,
      _allocations: payload as never,
    });
    setSaving(false);
    if (error) {
      toast({ title: "فشل التخصيص", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تخصيص الدُفعات" });
    onDone();
    onClose();
  };

  const reapplyFifo = () => {
    const map: Record<string, AllocRow[]> = {};
    const used: Record<string, number> = {};
    lines.forEach((line) => {
      let need = Number(line.quantity);
      const productBatches = batchesFor(line.product_id);
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
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تخصيص الدُفعات — {order.order_number}</DialogTitle>
          <DialogDescription>اختر من أي دُفعة سيتم خصم الكمية. الترتيب الافتراضي FIFO.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={reapplyFifo}>
                <Wand2 className="h-4 w-4" />إعادة تطبيق FIFO
              </Button>
            </div>

            {lines.map((line) => {
              const p = productMap.get(line.product_id);
              const need = Number(line.quantity);
              const allocated = lineAllocated(line.id);
              const ok = Math.abs(allocated - need) < 0.0001;
              const opts = batchesFor(line.product_id);
              return (
                <div key={line.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium">{p?.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p?.code}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">المطلوب: {fmtNumber(need)} {p?.unit}</Badge>
                      <Badge variant={ok ? "default" : "destructive"}>المخصص: {fmtNumber(allocated)}</Badge>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الدُفعة</TableHead>
                        <TableHead className="text-end">المتاح</TableHead>
                        <TableHead className="text-end">التكلفة</TableHead>
                        <TableHead className="w-32">الكمية المخصصة</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(allocs[line.id] ?? []).map((row, i) => {
                        const bt = opts.find((x) => x.id === row.batch_id);
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <select
                                value={row.batch_id}
                                onChange={(e) => updateAlloc(line.id, i, { batch_id: e.target.value })}
                                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                              >
                                <option value="">— اختر دُفعة —</option>
                                {opts.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {whMap.get(b.warehouse_id)} — تكلفة {fmtNumber(Number(b.unit_cost))} — متاح {fmtNumber(Number(b.remaining_quantity))}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="text-end tabular-nums">{bt ? fmtNumber(Number(bt.remaining_quantity)) : "—"}</TableCell>
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
                </div>
              );
            })}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}حفظ التخصيص
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
