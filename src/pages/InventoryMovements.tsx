import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeftRight, Loader2, Search, X, ArrowUpFromLine, ArrowDownToLine,
} from "lucide-react";
import type { StockMovement, InventoryItem, Warehouse, MovementType } from "@/lib/finhub-types";
import { MOVEMENT_TYPE_LABELS_AR } from "@/lib/finhub-types";
import { fmtNumber, fmtDateTime } from "@/components/inventory/inventory-lib";

const TYPE_ICON: Record<MovementType, React.ComponentType<{ className?: string }>> = {
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  adjust: ArrowLeftRight,
  transfer: ArrowLeftRight,
};

const InventoryMovements = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("stock_movements").select("*").order("movement_date", { ascending: false }).limit(500),
      supabase.from("items").select("*"),
      supabase.from("warehouses").select("*"),
    ]).then(([mv, it, wh]) => {
      if (mv.error) toast({ title: "فشل التحميل", description: mv.error.message, variant: "destructive" });
      setMovements((mv.data ?? []) as StockMovement[]);
      setItems((it.data ?? []) as InventoryItem[]);
      setWarehouses((wh.data ?? []) as Warehouse[]);
      setLoading(false);
    });
  }, [toast]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((m) => {
      const it = itemMap.get(m.item_id);
      const wh = whMap.get(m.warehouse_id);
      return [it?.code ?? "", it?.name ?? "", wh?.name ?? "", m.description ?? ""]
        .join(" ").toLowerCase().includes(q);
    });
  }, [movements, search, itemMap, whMap]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <ArrowLeftRight className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">حركات المخزن</h1>
          <p className="text-sm text-muted-foreground">سجل كامل بالحركات المعتمدة (آخر 500 حركة).</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالصنف أو المخزن..." className="pr-9 pl-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد حركات</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الصنف</TableHead>
                  <TableHead>المخزن</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>سعر الوحدة</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الوصف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const it = itemMap.get(m.item_id);
                  const wh = whMap.get(m.warehouse_id);
                  const Icon = TYPE_ICON[m.movement_type];
                  const isIn = m.movement_type === "in";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(m.movement_date)}</TableCell>
                      <TableCell>
                        <Badge variant={isIn ? "default" : "secondary"} className="gap-1.5">
                          <Icon className="h-3 w-3" />
                          {MOVEMENT_TYPE_LABELS_AR[m.movement_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{it?.name ?? "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{it?.code}</div>
                      </TableCell>
                      <TableCell className="text-sm">{wh?.name ?? "—"}</TableCell>
                      <TableCell className={`font-mono tabular-nums font-semibold ${isIn ? "text-primary" : "text-destructive"}`}>
                        {isIn ? "+" : "-"}{fmtNumber(m.quantity)} <span className="text-xs text-muted-foreground font-normal">{it?.unit}</span>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{fmtNumber(m.unit_price)}</TableCell>
                      <TableCell className="font-mono tabular-nums">{fmtNumber(m.unit_price * m.quantity)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={m.description ?? ""}>{m.description ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryMovements;
