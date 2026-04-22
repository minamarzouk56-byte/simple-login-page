import { useEffect, useMemo, useRef, useState } from "react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Boxes, Plus, Loader2, Search, X, MoreHorizontal, Pencil, Trash2,
  ArrowUp, ArrowDown, ArrowUpDown, Warehouse as WarehouseIcon, Tags, AlertTriangle,
  Settings2, FileSpreadsheet, FileDown, FileUp, FileText, CheckCircle2, Wallet, Filter,
} from "lucide-react";
import type { Warehouse, ItemCategory, InventoryItem } from "@/lib/finhub-types";
import { ItemFormDialog } from "@/components/inventory/ItemFormDialog";
import { WarehouseFormDialog } from "@/components/inventory/WarehouseFormDialog";
import { CategoryFormDialog } from "@/components/inventory/CategoryFormDialog";
import { fmtNumber, loadInventoryData, type ItemRow } from "@/components/inventory/inventory-lib";
import {
  exportItemsToExcel, downloadItemsTemplate, parseImportFile, importItems, exportItemsToPDF,
} from "@/components/inventory/inventory-io";

type SortKey = "code" | "name" | "category" | "unit" | "warehouse" | "cost" | "sale" | "qty" | "min";
type SortDir = "asc" | "desc";

const InventoryItems = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("inventory.manage");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  const [whFormOpen, setWhFormOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [deletingWh, setDeletingWh] = useState<Warehouse | null>(null);

  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ItemCategory | null>(null);
  const [deletingCat, setDeletingCat] = useState<ItemCategory | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await loadInventoryData();
      setRows(data.rows);
      setWarehouses(data.warehouses);
      setCategories(data.categories);
      setAccounts(data.accounts.map((a) => ({ id: a.id, code: a.code, name: a.name })));
    } catch (e) {
      toast({ title: "فشل التحميل", description: (e as Error).message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = rows;
    if (q) {
      arr = arr.filter((r) =>
        [r.code, r.name, r.unit, r.category_name ?? "", r.default_warehouse_name ?? ""]
          .join(" ").toLowerCase().includes(q),
      );
    }
    if (filterCategory !== "all") arr = arr.filter((r) => r.category_id === filterCategory);
    if (filterWarehouse !== "all") {
      arr = arr.filter((r) =>
        r.default_warehouse_id === filterWarehouse ||
        r.per_warehouse.some((p) => p.warehouse_id === filterWarehouse),
      );
    }
    if (filterStatus !== "all") arr = arr.filter((r) => (filterStatus === "active" ? r.is_active : !r.is_active));
    if (filterStock === "low") arr = arr.filter((r) => r.min_stock > 0 && r.total_quantity <= r.min_stock);
    if (filterStock === "ok") arr = arr.filter((r) => r.min_stock === 0 || r.total_quantity > r.min_stock);
    if (filterAccount !== "all") arr = arr.filter((r) => r.account_id === filterAccount);

    const sorted = [...arr].sort((a, b) => {
      const get = (r: ItemRow): string | number => {
        switch (sortKey) {
          case "code": return r.code;
          case "name": return r.name;
          case "category": return r.category_name ?? "";
          case "unit": return r.unit;
          case "warehouse": return r.default_warehouse_name ?? "";
          case "cost": return r.cost_price;
          case "sale": return r.sale_price;
          case "qty": return r.total_quantity;
          case "min": return r.min_stock;
        }
      };
      const va = get(a), vb = get(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, sortKey, sortDir, filterCategory, filterWarehouse, filterStatus, filterStock, filterAccount]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const low = rows.filter((r) => r.min_stock > 0 && r.total_quantity <= r.min_stock).length;
    const value = rows.reduce((sum, r) => sum + r.total_quantity * r.cost_price, 0);
    return { total, active, low, value };
  }, [rows]);

  const hasFilters = filterCategory !== "all" || filterWarehouse !== "all" || filterStatus !== "all" || filterStock !== "all" || filterAccount !== "all";
  const resetFilters = () => {
    setFilterCategory("all"); setFilterWarehouse("all");
    setFilterStatus("all"); setFilterStock("all"); setFilterAccount("all");
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3.5 w-3.5 opacity-40" /> :
    sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;

  const deleteItem = async (it: InventoryItem) => {
    const { error } = await supabase.from("items").delete().eq("id", it.id);
    if (error) { toast({ title: "فشل الحذف", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم حذف الصنف" });
    setDeletingItem(null);
    load();
  };

  const deleteWh = async (w: Warehouse) => {
    const { error } = await supabase.from("warehouses").delete().eq("id", w.id);
    if (error) { toast({ title: "فشل الحذف", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم حذف المخزن" });
    setDeletingWh(null);
    load();
  };

  const deleteCat = async (c: ItemCategory) => {
    const { error } = await supabase.from("item_categories").delete().eq("id", c.id);
    if (error) { toast({ title: "فشل الحذف", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم حذف الفئة" });
    setDeletingCat(null);
    load();
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = await parseImportFile(file);
      const catMap = new Map(categories.map((c) => [c.name, c.id]));
      const whMap = new Map(warehouses.map((w) => [w.name, w.id]));
      const accMap = new Map(accounts.map((a) => [a.code, a.id]));
      const count = await importItems(parsed, catMap, whMap, accMap);
      toast({ title: `تم استيراد ${count} صنف` });
      load();
    } catch (e) {
      toast({ title: "فشل الاستيراد", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
            <Boxes className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">إدارة المخزون</h1>
            <p className="text-sm text-muted-foreground">الأصناف، المخازن، وفئات الأصناف</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="items" dir="rtl">
        <TabsList>
          <TabsTrigger value="items"><Boxes className="h-4 w-4 ml-2" />الأصناف</TabsTrigger>
          <TabsTrigger value="warehouses"><WarehouseIcon className="h-4 w-4 ml-2" />المخازن</TabsTrigger>
          <TabsTrigger value="categories"><Tags className="h-4 w-4 ml-2" />الفئات</TabsTrigger>
        </TabsList>

        {/* === Items === */}
        <TabsContent value="items" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">إجمالي الأصناف</div>
                  <div className="text-2xl font-bold tabular-nums mt-1">{stats.total}</div>
                </div>
                <Boxes className="h-8 w-8 text-primary opacity-60" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">أصناف نشطة</div>
                  <div className="text-2xl font-bold tabular-nums mt-1 text-primary">{stats.active}</div>
                </div>
                <CheckCircle2 className="h-8 w-8 text-primary/60" />
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

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالكود أو الاسم..."
                className="pr-9 pl-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {canManage && (
              <Button onClick={() => { setEditingItem(null); setItemFormOpen(true); }}>
                <Plus className="h-4 w-4" />صنف جديد
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Settings2 className="h-4 w-4" />العمليات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => exportItemsToExcel(filtered)}>
                  <FileSpreadsheet className="h-4 w-4 ml-2" />تصدير Excel
                </DropdownMenuItem>
                {canManage && (
                  <>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <FileUp className="h-4 w-4 ml-2" />استيراد Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadItemsTemplate}>
                      <FileDown className="h-4 w-4 ml-2" />تحميل قالب Excel
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportItemsToPDF(filtered)}>
                  <FileText className="h-4 w-4 ml-2" />تصدير PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground px-2">
                <Filter className="h-4 w-4" />الفلاتر:
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="الفئة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="المخزن" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المخازن</SelectItem>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط فقط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStock} onValueChange={setFilterStock}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="مستوى المخزون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستويات</SelectItem>
                  <SelectItem value="low">مخزون منخفض</SelectItem>
                  <SelectItem value="ok">مخزون كافٍ</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="الحساب المرتبط" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحسابات</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="h-4 w-4" />مسح الفلاتر
                </Button>
              )}
              <div className="ms-auto text-xs text-muted-foreground tabular-nums">
                النتائج: {filtered.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد أصناف مطابقة</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {([
                        ["code", "الكود"], ["name", "الاسم"], ["unit", "الوحدة"],
                        ["category", "الفئة"], ["warehouse", "المخزن الافتراضي"],
                        ["cost", "سعر التكلفة"], ["sale", "سعر البيع"],
                        ["qty", "الرصيد"], ["min", "الحد الأدنى"],
                      ] as [SortKey, string][]).map(([k, label]) => (
                        <TableHead key={k}>
                          <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1.5 hover:text-foreground">
                            {label}<SortIcon k={k} />
                          </button>
                        </TableHead>
                      ))}
                      <TableHead>الحساب المرتبط</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const low = r.total_quantity <= r.min_stock && r.min_stock > 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.code}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {r.name}
                              {!r.is_active && <Badge variant="outline" className="text-xs">غير نشط</Badge>}
                              {low && <span title="الرصيد أقل من الحد الأدنى"><AlertTriangle className="h-4 w-4 text-destructive" /></span>}
                            </div>
                          </TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell className="text-sm">{r.category_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{r.default_warehouse_name ?? "—"}</TableCell>
                          <TableCell className="font-mono text-sm tabular-nums">{fmtNumber(r.cost_price)}</TableCell>
                          <TableCell className="font-mono text-sm tabular-nums">{fmtNumber(r.sale_price)}</TableCell>
                          <TableCell className="font-mono text-sm tabular-nums font-semibold">{fmtNumber(r.total_quantity)}</TableCell>
                          <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">{fmtNumber(r.min_stock)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.account_label ?? "—"}</TableCell>
                          <TableCell>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditingItem(r); setItemFormOpen(true); }}>
                                    <Pencil className="h-4 w-4 ml-2" />تعديل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDeletingItem(r)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 ml-2" />حذف
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Warehouses === */}
        <TabsContent value="warehouses" className="space-y-4">
          {canManage && (
            <Button onClick={() => { setEditingWh(null); setWhFormOpen(true); }}>
              <Plus className="h-4 w-4" />مخزن جديد
            </Button>
          )}
          <Card>
            <CardContent className="p-0">
              {warehouses.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد مخازن</div>
              ) : (
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
                          <Badge variant={w.is_active ? "default" : "outline"}>{w.is_active ? "نشط" : "متوقف"}</Badge>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingWh(w); setWhFormOpen(true); }}>
                                  <Pencil className="h-4 w-4 ml-2" />تعديل
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeletingWh(w)} className="text-destructive">
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

        {/* === Categories === */}
        <TabsContent value="categories" className="space-y-4">
          {canManage && (
            <Button onClick={() => { setEditingCat(null); setCatFormOpen(true); }}>
              <Plus className="h-4 w-4" />فئة جديدة
            </Button>
          )}
          <Card>
            <CardContent className="p-0">
              {categories.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد فئات</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الكود</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الفئة الأب</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((c) => {
                      const parent = categories.find((p) => p.id === c.parent_id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.code}</TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{parent?.name ?? "—"}</TableCell>
                          <TableCell>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditingCat(c); setCatFormOpen(true); }}>
                                    <Pencil className="h-4 w-4 ml-2" />تعديل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDeletingCat(c)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 ml-2" />حذف
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ItemFormDialog
        open={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        onSaved={load}
        editing={editingItem}
        warehouses={warehouses}
        categories={categories}
      />
      <WarehouseFormDialog open={whFormOpen} onClose={() => setWhFormOpen(false)} onSaved={load} editing={editingWh} />
      <CategoryFormDialog open={catFormOpen} onClose={() => setCatFormOpen(false)} onSaved={load} editing={editingCat} categories={categories} />

      <AlertDialog open={!!deletingItem} onOpenChange={(o) => !o && setDeletingItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف "{deletingItem?.name}" نهائياً. لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingItem && deleteItem(deletingItem)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingWh} onOpenChange={(o) => !o && setDeletingWh(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المخزن</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف مخزن "{deletingWh?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingWh && deleteWh(deletingWh)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingCat} onOpenChange={(o) => !o && setDeletingCat(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الفئة</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف فئة "{deletingCat?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingCat && deleteCat(deletingCat)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InventoryItems;
