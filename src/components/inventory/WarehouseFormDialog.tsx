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
import { Loader2 } from "lucide-react";
import type { Warehouse } from "@/lib/finhub-types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Warehouse | null;
}

const emptyForm = { name: "", location: "", notes: "", is_active: true };

export const WarehouseFormDialog = ({ open, onClose, onSaved, editing }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        location: editing.location ?? "",
        notes: editing.notes ?? "",
        is_active: editing.is_active,
      });
    } else setForm(emptyForm);
  }, [open, editing]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "أدخل اسم المخزن", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    const res = editing
      ? await supabase.from("warehouses").update(payload).eq("id", editing.id)
      : await supabase.from("warehouses").insert(payload as never);
    setSaving(false);
    if (res.error) {
      toast({ title: "فشل الحفظ", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "تم التعديل" : "تم إنشاء المخزن" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل مخزن" : "مخزن جديد"}</DialogTitle>
          <DialogDescription>بيانات المخزن.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>اسم المخزن *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>الموقع</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
