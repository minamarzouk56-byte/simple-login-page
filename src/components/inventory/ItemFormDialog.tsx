import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import type { InventoryItem, ItemCategory, Warehouse } from "@/lib/finhub-types";

interface AccountOpt {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: InventoryItem | null;
  warehouses: Warehouse[];
  categories: ItemCategory[];
}

const emptyForm = {
  name: "",
  unit: "قطعة",
  category_id: "",
  default_warehouse_id: "",
  cost_price: "0",
  sale_price: "0",
  min_stock: "0",
  account_id: "",
  description: "",
  is_active: true,
};

export const ItemFormDialog = ({ open, onClose, onSaved, editing, warehouses, categories }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("accounts")
      .select("id, code, name, type, is_active")
      .eq("is_active", true)
      .order("code")
      .then(({ data }) => {
        // only leaf accounts (no children)
        const all = (data ?? []) as AccountOpt[];
        setAccounts(all);
      });
    if (editing) {
      setForm({
        name: editing.name,
        unit: editing.unit,
        category_id: editing.category_id ?? "",
        default_warehouse_id: editing.default_warehouse_id ?? "",
        cost_price: String(editing.cost_price),
        sale_price: String(editing.sale_price),
        min_stock: String(editing.min_stock),
        account_id: editing.account_id ?? "",
        description: editing.description ?? "",
        is_active: editing.is_active,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "أدخل اسم الصنف", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim() || "قطعة",
      category_id: form.category_id || null,
      default_warehouse_id: form.default_warehouse_id || null,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      min_stock: Number(form.min_stock) || 0,
      account_id: form.account_id || null,
      description: form.description.trim() || null,
      is_active: form.is_active,
    };
    const res = editing
      ? await supabase.from("items").update(payload).eq("id", editing.id)
      : await supabase.from("items").insert(payload as never);
    setSaving(false);
    if (res.error) {
      toast({ title: "فشل الحفظ", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم التعديل" : "تم إضافة الصنف" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل صنف" : "صنف جديد"}</DialogTitle>
          <DialogDescription>أدخل بيانات الصنف الكاملة.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label>اسم الصنف *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>الوحدة</Label>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="قطعة / كيلو / لتر" />
          </div>

          <div className="space-y-1.5">
            <Label>الفئة</Label>
            <SearchableSelect
              value={form.category_id}
              onChange={(v) => setForm({ ...form, category_id: v })}
              options={categories.map((c) => ({ value: c.id, label: c.name, prefix: c.code }))}
              placeholder="اختر فئة"
              allowClear
            />
          </div>

          <div className="space-y-1.5">
            <Label>المخزن الافتراضي</Label>
            <SearchableSelect
              value={form.default_warehouse_id}
              onChange={(v) => setForm({ ...form, default_warehouse_id: v })}
              options={warehouses.map((w) => ({ value: w.id, label: w.name, prefix: w.code }))}
              placeholder="اختر مخزناً"
              allowClear
            />
          </div>

          <div className="space-y-1.5">
            <Label>الحساب المرتبط من شجرة الحسابات</Label>
            <SearchableSelect
              value={form.account_id}
              onChange={(v) => setForm({ ...form, account_id: v })}
              options={accounts.map((a) => ({ value: a.id, label: a.name, prefix: a.code, keywords: a.code }))}
              placeholder="اختر حساباً"
              allowClear
            />
          </div>

          <div className="space-y-1.5">
            <Label>سعر التكلفة</Label>
            <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>سعر البيع</Label>
            <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>الحد الأدنى للرصيد</Label>
            <Input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>وصف</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>نشط</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
