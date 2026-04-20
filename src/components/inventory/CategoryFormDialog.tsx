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
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import type { ItemCategory } from "@/lib/finhub-types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: ItemCategory | null;
  categories: ItemCategory[];
}

const emptyForm = { name: "", parent_id: "", is_active: true };

export const CategoryFormDialog = ({ open, onClose, onSaved, editing, categories }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        parent_id: editing.parent_id ?? "",
        is_active: editing.is_active,
      });
    } else setForm(emptyForm);
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "أدخل اسم الفئة", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      parent_id: form.parent_id || null,
      is_active: form.is_active,
    };
    const res = editing
      ? await supabase.from("item_categories").update(payload).eq("id", editing.id)
      : await supabase.from("item_categories").insert(payload as never);
    setSaving(false);
    if (res.error) {
      toast({ title: "فشل الحفظ", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم التعديل" : "تم إنشاء الفئة" });
    onSaved();
    onClose();
  };

  const parentOpts = categories.filter((c) => c.id !== editing?.id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل فئة" : "فئة جديدة"}</DialogTitle>
          <DialogDescription>تنظيم الأصناف ضمن فئات.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>اسم الفئة *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الفئة الأب (اختياري)</Label>
            <SearchableSelect
              value={form.parent_id}
              onChange={(v) => setForm({ ...form, parent_id: v })}
              options={parentOpts.map((c) => ({ value: c.id, label: c.name, prefix: c.code }))}
              placeholder="بدون"
              allowClear
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>نشطة</Label>
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
