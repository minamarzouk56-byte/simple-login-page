import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Boxes, Loader2, Search, X, AlertTriangle, Wallet, Layers, PackagePlus } from "lucide-react";
import type { Product, Warehouse, Batch } from "@/lib/finhub-types";
import { fmtNumber } from "@/lib/inventory-utils";
import { AddStockDialog } from "@/components/inventory/AddStockDialog";

interface ProductRow {
  product: Product;
  total: number;
  by_warehouse: { warehouse_id: string; warehouse_name: string; quantity: number; }[];
  batch_count: number;
  value: number;
}

const Inventory = () => {
  useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, w, b] = await Promise.all([
      supabase.from("items").select("*").eq("is_active", true).order("code"),
      supabase.from("warehouses").select("*"),
      supabase.from("batches").select("*").gt("remaining_quantity", 0),
    ]);
    const products = (p.data ?? []) as Product[];
    const warehouses = (w.data ?? []) as Warehouse[];
    const batches = (b.data ?? []) as Batch[];
    const whMap = new Map(warehouses.map((x) => [x.id, x.name]));
    const prodMap = new Map(products.map((x) => [x.id, x]));

    // فقط المنتجات اللي عندها batches بكميات > 0
    const productIdsWithStock = new Set(batches.map((bt) => bt.product_id));

    const result: ProductRow[] = [...productIdsWithStock].map((pid) => {
      const prod = prodMap.get(pid);
      if (!prod) return null;
      const myBatches = batches.filter((bt) => bt.product_id === pid);
      const byWh = new Map<string, number>();
      let value = 0;
      myBatches.forEach((bt) => {
        byWh.set(bt.warehouse_id, (byWh.get(bt.warehouse_id) ?? 0) + Number(bt.remaining_quantity));
        value += Number(bt.remaining_quantity) * Number(bt.unit_cost);
      });
      const by_warehouse = [...byWh.entries()].map(([id, qty]) => ({
        warehouse_id: id, warehouse_name: whMap.get(id) ?? "—", quantity: qty,
      }));
      const total = by_warehouse.reduce((s, x) => s + x.quantity, 0);
      return { product: prod, total, by_warehouse, batch_count: myBatches.length, value };
    }).filter(Boolean) as ProductRow[];

    result.sort((a, b) => a.product.code.localeCompare(b.product.code));
    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.product.code, r.product.name, r.product.unit].join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total_products = rows.length;
    const low = rows.filter((r) => r.product.min_stock > 0 && r.total <= r.product.min_stock).length;
    const value = rows.reduce((s, r) => s + r.value, 0);
    const batch_count = rows.reduce((s, r) => s + r.batch_count, 0);
    return { total_products, low, value, batch_count };
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
            <p className="text-sm text-muted-foreground">عرض الأرصدة والدُفعات في كل مخزن</p>
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
              <div className="text-xs text-muted-foreground">منتجات بها مخزون</div>
              <div className="text-2xl font-bold tabular-nums mt-1">{stats.total_products}</div>
            </div>
            <Boxes className="h-8 w-8 text-primary opacity-60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">عدد الدُفعات النشطة</div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-primary">{stats.batch_count}</div>
            </div>
            <Layers className="h-8 w-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">مخزون منخفض</div>
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
          placeholder="ابحث بكود أو اسم منتج..." className="pr-9 pl-9" />
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
              <div>لا يوجد مخزون حتى الآن</div>
              <div className="text-xs">اضغط "إضافة مخزون" لإنشاء أول دُفعة</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>التوزيع على المخازن</TableHead>
                  <TableHead className="text-end">إجمالي الكمية</TableHead>
                  <TableHead className="text-end">عدد الدُفعات</TableHead>
                  <TableHead className="text-end">قيمة المخزون</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const low = r.product.min_stock > 0 && r.total <= r.product.min_stock;
                  return (
                    <TableRow key={r.product.id}>
                      <TableCell className="font-mono text-xs">{r.product.code}</TableCell>
                      <TableCell className="font-medium">{r.product.name}</TableCell>
                      <TableCell>{r.product.unit}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.by_warehouse.map((w) => (
                            <Badge key={w.warehouse_id} variant="outline" className="font-normal">
                              {fmtNumber(w.quantity)} في {w.warehouse_name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className={`text-end tabular-nums font-bold ${low ? "text-destructive" : ""}`}>
                        {fmtNumber(r.total)}
                        {low && <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{r.batch_count}</TableCell>
                      <TableCell className="text-end tabular-nums">{fmtNumber(r.value)}</TableCell>
                    </TableRow>
                  );
                })}
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
