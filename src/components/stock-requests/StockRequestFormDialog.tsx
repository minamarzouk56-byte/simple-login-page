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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Customer, Product, StockRequestType, Supplier } from "@/lib/finhub-types";
import { STOCK_REQUEST_TYPE_LABELS_AR } from "@/lib/finhub-types";

interface LineDraft {
  product_id: string;
  quantity: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  requestType: StockRequestType;
}

const blank = (): LineDraft => ({ product_id: "", quantity: "1", notes: "" });

export const StockRequestFormDialog = ({ open, onClose, onSaved, requestType }: Props) => {
  const { toast } = useToast();
  const isSupplier = requestType === "add" || requestType === "purchase_return";

  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Array<Customer | Supplier>>([]);
  const [partnerId, setPartnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blank()]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const partnerTable = isSupplier ? "suppliers" : "customers";
      const [p, pt] = await Promise.all([
        supabase.from("items").select("*").eq("is_active", true).order("code"),
        supabase.from(partnerTable).select("*").eq("is_active", true).order("name"),
      ]);
      setProducts((p.data ?? []) as Product[]);
      setPartners((pt.data ?? []) as Array<Customer | Supplier>);
      setPartnerId("");
      setNotes("");
      setLines([blank()]);
    })();
  }, [open, isSupplier]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const addLine = () => setLines((s) => [...s, blank()]);
  const removeLine = (idx: number) => setLines((s) => s.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!partnerId) {
      toast({ title: isSupplier ? "اختر المورد" : "اختر العميل", variant: "destructive" });
      return;
    }
    const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (valid.length === 0) {
      toast({ title: "أضف بنداً واحداً على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("create_stock_request", {
      _request_type: requestType,
      _customer_id: isSupplier ? null : partnerId,
      _supplier_id: isSupplier ? partnerId : null,
      _notes: notes || null,
      _lines: valid.map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
        notes: l.notes || null,
      })) as never,
    });
    setSaving(false);
    if (error) {
      toast({ title: "فشل إنشاء الطلب", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال الطلب بنجاح" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{STOCK_REQUEST_TYPE_LABELS_AR[requestType]}</DialogTitle>
          <DialogDescription>
            حدد {isSupplier ? "المورد" : "العميل"} والمنتجات المطلوبة. سيتم إرسال الطلب للمراجعة والتسوية.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>{isSupplier ? "المورد" : "العميل"} *</Label>
            <SearchableSelect
              value={partnerId}
              onChange={setPartnerId}
              options={partners.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
              placeholder={isSupplier ? "اختر مورد" : "اختر عميل"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>البنود</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />إضافة منتج
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead className="w-32">الكمية</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => {
                const p = productMap.get(line.product_id);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <SearchableSelect
                        value={line.product_id}
                        onChange={(v) => updateLine(i, { product_id: v })}
                        options={products.map((pr) => ({ value: pr.id, label: `${pr.code} - ${pr.name}` }))}
                        placeholder="اختر منتج"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" step="0.01" value={line.quantity}
                          onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                        {p && <span className="text-xs text-muted-foreground shrink-0">{p.unit}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input value={line.notes}
                        onChange={(e) => updateLine(i, { notes: e.target.value })}
                        placeholder="اختياري" />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div>
          <Label>ملاحظات الطلب</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}إرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
