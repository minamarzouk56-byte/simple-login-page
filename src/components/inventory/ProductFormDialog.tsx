import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import type { Product, ItemCategory } from "@/lib/finhub-types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Product | null;
  categories: ItemCategory[];
}

const empty = {
  name: "",
  unit: "قطعة",
  category_id: "",
  sale_price: "0",
  min_stock: "0",
  description: "",
  is_active: true,
};

export const ProductFormDialog = ({ open, onClose, onSaved, editing, categories }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        unit: editing.unit,
        category_id: editing.category_id ?? "",
        sale_price: String(editing.sale_price),
        min_stock: String(editing.min_stock),
        description: editing.description ?? "",
        is_active: editing.is_active,
      });
    } else {
      setForm(empty);
    }
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "أدخل اسم المنتج", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim() || "قطعة",
      category_id: form.category_id || null,
      sale_price: Number(form.sale_price) || 0,
      min_stock: Number(form.min_stock) || 0,
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
    toast({ title: editing ? "تم التعديل" : "تم إضافة المنتج" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
          <DialogDescription>البيانات الأساسية للمنتج فقط — التكلفة والمخزن يحددوا عند الشراء.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label>اسم المنتج *</Label>
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
            <Label>سعر البيع</Label>
            <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>الحد الأدنى للرصيد</Label>
            <Input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>الوصف</Label>
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
