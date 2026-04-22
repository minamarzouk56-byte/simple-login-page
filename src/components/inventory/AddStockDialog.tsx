import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, PackagePlus } from "lucide-react";
import type { Product, Warehouse, Batch, Supplier, Account } from "@/lib/finhub-types";
import { fmtNumber } from "@/lib/inventory-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AddStockDialog = ({ open, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setProductId(""); setWarehouseId(""); setSupplierId(""); setAccountId("");
    setQuantity(""); setUnitCost(""); setNotes("");
    (async () => {
      setLoading(true);
      const [p, w, s, a] = await Promise.all([
        supabase.from("items").select("*").eq("is_active", true).order("code"),
        supabase.from("warehouses").select("*").eq("is_active", true).order("code"),
        supabase.from("suppliers").select("*").eq("is_active", true).order("code"),
        supabase.from("accounts").select("*").eq("is_active", true).order("code"),
      ]);
      setProducts((p.data ?? []) as Product[]);
      setWarehouses((w.data ?? []) as Warehouse[]);
      setSuppliers((s.data ?? []) as Supplier[]);
      const allAccounts = (a.data ?? []) as Account[];
      // فقط الحسابات الفرعية (آخر مستوى)
      const parentIds = new Set(allAccounts.map((x) => x.parent_id).filter(Boolean) as string[]);
      setAccounts(allAccounts.filter((x) => !parentIds.has(x.id)));
      setLoading(false);
    })();
  }, [open]);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const warehouse = useMemo(() => warehouses.find((w) => w.id === warehouseId), [warehouses, warehouseId]);

  const previewCode = useMemo(() => {
    if (!product || !warehouse || !unitCost) return null;
    return `${product.code}-${warehouse.code}-${Number(unitCost)}`;
  }, [product, warehouse, unitCost]);

  const submit = async () => {
    if (!productId) { toast({ title: "اختر المنتج", variant: "destructive" }); return; }
    if (!warehouseId) { toast({ title: "اختر المخزن", variant: "destructive" }); return; }
    if (!supplierId) { toast({ title: "اختر المورد", variant: "destructive" }); return; }
    if (!accountId) { toast({ title: "اختر حساب من شجرة الحسابات", variant: "destructive" }); return; }
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!(qty > 0)) { toast({ title: "أدخل كمية صحيحة", variant: "destructive" }); return; }
    if (!(cost >= 0)) { toast({ title: "أدخل تكلفة صحيحة", variant: "destructive" }); return; }

    setSaving(true);

    // ابحث عن batch موجود بنفس (product, warehouse, supplier, account, unit_cost)
    const { data: existing, error: findErr } = await supabase
      .from("batches")
      .select("*")
      .eq("product_id", productId)
      .eq("warehouse_id", warehouseId)
      .eq("supplier_id", supplierId)
      .eq("account_id", accountId)
      .eq("unit_cost", cost)
      .maybeSingle();

    if (findErr) {
      setSaving(false);
      toast({ title: "خطأ", description: findErr.message, variant: "destructive" });
      return;
    }

    let batchId: string;
    if (existing) {
      const { data: upd, error: updErr } = await supabase
        .from("batches")
        .update({
          quantity: Number((existing as Batch).quantity) + qty,
          remaining_quantity: Number((existing as Batch).remaining_quantity) + qty,
        })
        .eq("id", (existing as Batch).id)
        .select("id")
        .single();
      if (updErr || !upd) {
        setSaving(false);
        toast({ title: "فشل التحديث", description: updErr?.message, variant: "destructive" });
        return;
      }
      batchId = upd.id;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("batches")
        .insert({
          product_id: productId,
          warehouse_id: warehouseId,
          supplier_id: supplierId,
          account_id: accountId,
          unit_cost: cost,
          quantity: qty,
          remaining_quantity: qty,
          created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (insErr || !ins) {
        setSaving(false);
        toast({ title: "فشل الإضافة", description: insErr?.message, variant: "destructive" });
        return;
      }
      batchId = ins.id;
    }

    // سجّل حركة مخزون
    await supabase.from("stock_movements").insert({
      product_id: productId,
      warehouse_id: warehouseId,
      batch_id: batchId,
      movement_type: "in",
      quantity: qty,
      unit_cost: cost,
      description: notes.trim() || "إضافة مخزون يدوية",
      created_by: user?.id ?? null,
    } as never);

    setSaving(false);
    toast({ title: existing ? "تم إضافة الكمية لدُفعة موجودة" : "تم إنشاء دُفعة جديدة" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            إضافة مخزون
          </DialogTitle>
          <DialogDescription>
            اختر منتجاً موجوداً وأدخل الكمية وتكلفة الشراء والمخزن. سيتم تجميع الدُفعات تلقائياً عند تطابق (المنتج + المخزن + التكلفة).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>المنتج *</Label>
              <SearchableSelect
                value={productId}
                onChange={setProductId}
                options={products.map((p) => ({ value: p.id, label: p.name, prefix: p.code }))}
                placeholder="اختر منتج من القائمة"
              />
            </div>

            <div className="space-y-1.5">
              <Label>المخزن *</Label>
              <SearchableSelect
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouses.map((w) => ({ value: w.id, label: w.name, prefix: w.code }))}
                placeholder="اختر مخزن"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الكمية * {product && <span className="text-muted-foreground text-xs">({product.unit})</span>}</Label>
              <Input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>تكلفة الوحدة *</Label>
              <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>إجمالي التكلفة</Label>
              <Input value={fmtNumber(Number(quantity || 0) * Number(unitCost || 0))} readOnly className="bg-muted/50 tabular-nums" />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
            </div>

            {previewCode && (
              <div className="md:col-span-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">كود الدُفعة المقترح:</div>
                <div className="font-mono font-medium text-primary">{previewCode}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  لو فيه دُفعة بنفس الكود هتتجمع الكمية معها، وإلا هتتنشئ دُفعة جديدة.
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
