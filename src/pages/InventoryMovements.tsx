import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight, Loader2, ArrowDown, ArrowUp } from "lucide-react";
import type { StockMovement, Product, Warehouse } from "@/lib/finhub-types";
import { fmtDateTime, fmtNumber } from "@/lib/inventory-utils";
import { MOVEMENT_TYPE_LABELS_AR } from "@/lib/finhub-types";

const InventoryMovements = () => {
  const [loading, setLoading] = useState(true);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [productMap, setProductMap] = useState<Map<string, string>>(new Map());
  const [whMap, setWhMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [m, p, w] = await Promise.all([
        supabase.from("stock_movements").select("*").order("movement_date", { ascending: false }).limit(500),
        supabase.from("items").select("id, code, name"),
        supabase.from("warehouses").select("id, name"),
      ]);
      setMoves((m.data ?? []) as StockMovement[]);
      setProductMap(new Map(((p.data ?? []) as Product[]).map((x) => [x.id, `${x.code} - ${x.name}`])));
      setWhMap(new Map(((w.data ?? []) as Warehouse[]).map((x) => [x.id, x.name])));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <ArrowLeftRight className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">حركات المخزن</h1>
          <p className="text-sm text-muted-foreground">آخر 500 حركة مخزون</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : moves.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد حركات</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>المخزن</TableHead>
                  <TableHead className="text-end">الكمية</TableHead>
                  <TableHead className="text-end">سعر الوحدة</TableHead>
                  <TableHead>الوصف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{fmtDateTime(m.movement_date)}</TableCell>
                    <TableCell>
                      <Badge variant={m.movement_type === "in" ? "default" : "secondary"}
                        className="gap-1">
                        {m.movement_type === "in" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                        {MOVEMENT_TYPE_LABELS_AR[m.movement_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{productMap.get(m.product_id) ?? "—"}</TableCell>
                    <TableCell>{whMap.get(m.warehouse_id) ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmtNumber(Number(m.quantity))}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmtNumber(Number(m.unit_cost))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.description ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryMovements;
