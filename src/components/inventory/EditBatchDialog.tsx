import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import type { Batch, Product } from "@/lib/finhub-types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  batch: Batch | null;
  product: Product | null;
}

export const EditBatchDialog = ({ open, onClose, onSaved, batch, product }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [remaining, setRemaining] = useState("");
  const [unitCost, setUnitCost] = useState("");

  useEffect(() => {
    if (!open || !batch) return;
    setRemaining(String(batch.remaining_quantity));
    setUnitCost(String(batch.unit_cost));
  }, [open, batch]);

  if (!batch || !product) return null;

  const consumed = Number(batch.quantity) - Number(batch.remaining_quantity);

  const submit = async () => {
    const newRemaining = Number(remaining);
    const newCost = Number(unitCost);
    if (!(newRemaining >= 0)) { toast({ title: "كمية غير صحيحة", variant: "destructive" }); return; }
    if (!(newCost >= 0)) { toast({ title: "تكلفة غير صحيحة", variant: "destructive" }); return; }
    if (newRemaining < consumed) {
      toast({
        title: "لا يمكن تقليل الكمية تحت المستهلك",
        description: `تم استهلاك ${consumed} من هذه الدُفعة`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    // الكمية الأصلية = المستهلك + المتبقي الجديد
    const newQuantity = consumed + newRemaining;
    const { error } = await supabase
      .from("batches")
      .update({
        remaining_quantity: newRemaining,
        quantity: newQuantity,
        unit_cost: newCost,
        // مسح الـ display_code علشان الترجر يعيد توليده بالتكلفة الجديدة
        display_code: null,
      } as never)
      .eq("id", batch.id);

    setSaving(false);
    if (error) {
      toast({ title: "فشل التعديل", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تعديل الدُفعة" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            تعديل الدُفعة
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-primary">{batch.display_code}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الكمية المتبقية ({product.unit})</Label>
            <Input type="number" step="0.01" min={consumed} value={remaining} onChange={(e) => setRemaining(e.target.value)} />
            {consumed > 0 && (
              <div className="text-xs text-muted-foreground">
                مستهلك من الدُفعة: {consumed} {product.unit} — لا يمكن النزول تحت هذا الرقم
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>تكلفة الوحدة</Label>
            <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            <div className="text-xs text-muted-foreground">
              تغيير التكلفة سيغيّر كود الدُفعة تلقائياً.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
