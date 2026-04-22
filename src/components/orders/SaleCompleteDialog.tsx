import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { Order, OrderLine } from "@/lib/finhub-types";
import { fmtNumber } from "@/lib/inventory-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  order: Order;
}

export const SaleCompleteDialog = ({ open, onClose, onDone, order }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [taxPercent, setTaxPercent] = useState(String(order.tax_percent ?? 0));
  const [discount, setDiscount] = useState(String(order.discount_amount ?? 0));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const r = await supabase.from("order_lines").select("*").eq("order_id", order.id);
      setLines((r.data ?? []) as OrderLine[]);
    })();
  }, [open, order.id]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + Number(l.line_total), 0), [lines]);
  const taxAmt = useMemo(() => (subtotal * (Number(taxPercent) || 0)) / 100, [subtotal, taxPercent]);
  const total = useMemo(() => subtotal + taxAmt - (Number(discount) || 0), [subtotal, taxAmt, discount]);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("complete_sale_order", {
      _order_id: order.id,
      _tax_percent: Number(taxPercent) || 0,
      _discount_amount: Number(discount) || 0,
      _notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "فشل التأكيد", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تأكيد الطلب وخصم المخزون ونشر القيد" });
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تأكيد البيع — {order.order_number}</DialogTitle>
          <DialogDescription>تأكيد نهائي. سيتم خصم المخزون من الدُفعات ونشر القيد المحاسبي.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>نسبة الضريبة %</Label>
            <Input type="number" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الخصم</Label>
            <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>ملاحظات</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>الإجمالي قبل الضريبة:</span><span className="tabular-nums font-medium">{fmtNumber(subtotal)}</span></div>
          <div className="flex justify-between"><span>الضريبة:</span><span className="tabular-nums">{fmtNumber(taxAmt)}</span></div>
          <div className="flex justify-between"><span>الخصم:</span><span className="tabular-nums">- {fmtNumber(Number(discount) || 0)}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t"><span>الإجمالي النهائي:</span><span className="tabular-nums text-primary">{fmtNumber(total)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}تأكيد ونشر القيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
