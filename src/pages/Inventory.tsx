import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Boxes, Loader2, Search, X, AlertTriangle, Wallet, Layers, PackagePlus } from "lucide-react";
import type { Product, Warehouse, Batch } from "@/lib/finhub-types";
import { fmtNumber } from "@/lib/inventory-utils";
import { AddStockDialog } from "@/components/inventory/AddStockDialog";

interface BatchRow {
  batch: Batch;
  product: Product;
  warehouse_name: string;
  warehouse_code: string;
  value: number;
  low: boolean;
}

const Inventory = () => {
  useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, w, b] = await Promise.all([
      supabase.from("items").select("*"),
      supabase.from("warehouses").select("*"),
      supabase.from("batches").select("*").gt("remaining_quantity", 0).order("created_at", { ascending: true }),
    ]);
    const products = (p.data ?? []) as Product[];
    const warehouses = (w.data ?? []) as Warehouse[];
    const batches = (b.data ?? []) as Batch[];
    const prodMap = new Map(products.map((x) => [x.id, x]));
    const whMap = new Map(warehouses.map((x) => [x.id, x]));

    const result: BatchRow[] = batches.map((bt) => {
      const product = prodMap.get(bt.product_id);
      const wh = whMap.get(bt.warehouse_id);
      if (!product) return null;
      const qty = Number(bt.remaining_quantity);
      return {
        batch: bt,
        product,
        warehouse_name: wh?.name ?? "—",
        warehouse_code: wh?.code ?? "—",
        value: qty * Number(bt.unit_cost),
        low: product.min_stock > 0 && qty <= product.min_stock,
      };
    }).filter(Boolean) as BatchRow[];

    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.product.code, r.product.name, r.batch.display_code ?? "", r.warehouse_name, r.warehouse_code]
        .join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const batch_count = rows.length;
    const distinct_products = new Set(rows.map((r) => r.product.id)).size;
    const low = rows.filter((r) => r.low).length;
    const value = rows.reduce((s, r) => s + r.value, 0);
    return { distinct_products, batch_count, low, value };
  }, [rows]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
            <Boxes className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">إدارة المخزون</h1>
            <p className="text-sm text-muted-foreground">كل دُفعة (Batch) في سطر مستقل</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <PackagePlus className="h-4 w-4" />
          إضافة مخزون
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">عدد الدُفعات النشطة</div>
              <div className="text-2xl font-bold tabular-nums mt-1">{stats.batch_count}</div>
            </div>
            <Layers className="h-8 w-8 text-primary opacity-60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">منتجات مختلفة</div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-primary">{stats.distinct_products}</div>
            </div>
            <Boxes className="h-8 w-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">دُفعات بمخزون منخفض</div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-destructive">{stats.low}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">إجمالي قيمة المخزون</div>
              <div className="text-xl font-bold tabular-nums mt-1">{fmtNumber(stats.value)}</div>
            </div>
            <Wallet className="h-8 w-8 text-primary opacity-60" />
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بكود الدُفعة أو المنتج أو المخزن..." className="pr-9 pl-9" />
        {search && (
          <button onClick={() => setSearch("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-3">
              <Boxes className="h-12 w-12 mx-auto opacity-30" />
              <div>لا توجد دُفعات حتى الآن</div>
              <div className="text-xs">اضغط "إضافة مخزون" لإنشاء أول دُفعة</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>كود الدُفعة</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>المخزن</TableHead>
                  <TableHead className="text-end">تكلفة الوحدة</TableHead>
                  <TableHead className="text-end">الكمية</TableHead>
                  <TableHead className="text-end">قيمة الدُفعة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.batch.id}>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-xs font-semibold text-primary">
                        {r.batch.display_code ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.product.code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.warehouse_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.warehouse_code}</div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{fmtNumber(Number(r.batch.unit_cost))}</TableCell>
                    <TableCell className={`text-end tabular-nums font-bold ${r.low ? "text-destructive" : ""}`}>
                      {fmtNumber(Number(r.batch.remaining_quantity))} {r.product.unit}
                      {r.low && <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{fmtNumber(r.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddStockDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
    </div>
  );
};

export default Inventory;
