import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Boxes, Plus, Loader2, Search, X, MoreHorizontal, Pencil, Trash2,
  Warehouse as WarehouseIcon, Tags, Package,
} from "lucide-react";
import type { Warehouse, ItemCategory, Product } from "@/lib/finhub-types";
import { ProductFormDialog } from "@/components/inventory/ProductFormDialog";
import { WarehouseFormDialog } from "@/components/inventory/WarehouseFormDialog";
import { CategoryFormDialog } from "@/components/inventory/CategoryFormDialog";
import { fmtNumber } from "@/lib/inventory-utils";

const Products = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("inventory.manage");

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [search, setSearch] = useState("");

  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const [whOpen, setWhOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [deletingWh, setDeletingWh] = useState<Warehouse | null>(null);

  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ItemCategory | null>(null);
  const [deletingCat, setDeletingCat] = useState<ItemCategory | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, w, c] = await Promise.all([
      supabase.from("items").select("*").order("code"),
      supabase.from("warehouses").select("*").order("code"),
      supabase.from("item_categories").select("*").order("code"),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setWarehouses((w.data ?? []) as Warehouse[]);
    setCategories((c.data ?? []) as ItemCategory[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.code, p.name, p.unit, catMap.get(p.category_id ?? "") ?? ""]
        .join(" ").toLowerCase().includes(q),
    );
  }, [products, search, catMap]);

  const remove = async (table: "items" | "warehouses" | "item_categories", id: string, label: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast({ title: `فشل حذف ${label}`, description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `تم حذف ${label}` });
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <Package className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">المنتجات</h1>
          <p className="text-sm text-muted-foreground">البيانات الأساسية للمنتجات والمخازن والفئات</p>
        </div>
      </div>

      <Tabs defaultValue="products" dir="rtl">
        <TabsList>
          <TabsTrigger value="products"><Boxes className="h-4 w-4 ml-2" />المنتجات</TabsTrigger>
          <TabsTrigger value="warehouses"><WarehouseIcon className="h-4 w-4 ml-2" />المخازن</TabsTrigger>
          <TabsTrigger value="categories"><Tags className="h-4 w-4 ml-2" />الفئات</TabsTrigger>
        </TabsList>

        {/* === Products === */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالكود أو الاسم..." className="pr-9 pl-9" />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {canManage && (
              <Button onClick={() => { setEditingProduct(null); setProductOpen(true); }}>
                <Plus className="h-4 w-4" />منتج جديد
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد منتجات</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الكود</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>الفئة</TableHead>
                      <TableHead className="text-end">سعر البيع</TableHead>
                      <TableHead className="text-end">الحد الأدنى</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.code}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.unit}</TableCell>
                        <TableCell>{catMap.get(p.category_id ?? "") ?? "—"}</TableCell>
                        <TableCell className="text-end tabular-nums">{fmtNumber(p.sale_price)}</TableCell>
                        <TableCell className="text-end tabular-nums">{fmtNumber(p.min_stock)}</TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? "default" : "secondary"}>
                            {p.is_active ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingProduct(p); setProductOpen(true); }}>
                                  <Pencil className="h-4 w-4 ml-2" />تعديل
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive"
                                  onClick={() => setDeletingProduct(p)}>
                                  <Trash2 className="h-4 w-4 ml-2" />حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Warehouses === */}
        <TabsContent value="warehouses" className="space-y-4">
          {canManage && (
            <Button onClick={() => { setEditingWh(null); setWhOpen(true); }}>
              <Plus className="h-4 w-4" />مخزن جديد
            </Button>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الموقع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.code}</TableCell>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>{w.location ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={w.is_active ? "default" : "secondary"}>
                        {w.is_active ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingWh(w); setWhOpen(true); }}>
                              <Pencil className="h-4 w-4 ml-2" />تعديل
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeletingWh(w)}>
                              <Trash2 className="h-4 w-4 ml-2" />حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* === Categories === */}
        <TabsContent value="categories" className="space-y-4">
          {canManage && (
            <Button onClick={() => { setEditingCat(null); setCatOpen(true); }}>
              <Plus className="h-4 w-4" />فئة جديدة
            </Button>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingCat(c); setCatOpen(true); }}>
                              <Pencil className="h-4 w-4 ml-2" />تعديل
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeletingCat(c)}>
                              <Trash2 className="h-4 w-4 ml-2" />حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ProductFormDialog open={productOpen} onClose={() => setProductOpen(false)}
        onSaved={load} editing={editingProduct} categories={categories} />

      <WarehouseFormDialog open={whOpen} onClose={() => setWhOpen(false)}
        onSaved={load} editing={editingWh} />

      <CategoryFormDialog open={catOpen} onClose={() => setCatOpen(false)}
        onSaved={load} editing={editingCat} categories={categories} />

      <AlertDialog open={!!deletingProduct} onOpenChange={(o) => !o && setDeletingProduct(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف "{deletingProduct?.name}"؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingProduct && remove("items", deletingProduct.id, "المنتج")}
              className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingWh} onOpenChange={(o) => !o && setDeletingWh(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المخزن</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف "{deletingWh?.name}"؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingWh && remove("warehouses", deletingWh.id, "المخزن")}
              className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingCat} onOpenChange={(o) => !o && setDeletingCat(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الفئة</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف "{deletingCat?.name}"؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingCat && remove("item_categories", deletingCat.id, "الفئة")}
              className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
