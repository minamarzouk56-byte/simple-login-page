import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Layers } from "lucide-react";
import type { Batch, Product, Warehouse, StockMovement } from "@/lib/finhub-types";
import { fmtNumber, fmtQty, fmtDateTime } from "@/lib/inventory-utils";
import { MOVEMENT_TYPE_LABELS_AR } from "@/lib/finhub-types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Props {
  open: boolean;
  onClose: () => void;
  batch: Batch | null;
  product: Product | null;
  warehouseName: string;
  warehouseCode: string;
}

export const BatchDetailsDialog = ({ open, onClose, batch, product, warehouseName, warehouseCode }: Props) => {
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (!open || !batch) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("batch_id", batch.id)
        .order("movement_date", { ascending: false });
      setMovements((data ?? []) as StockMovement[]);
      setLoading(false);
    })();
  }, [open, batch]);

  if (!batch || !product) return null;

  const consumed = Number(batch.quantity) - Number(batch.remaining_quantity);
  const totalValue = Number(batch.remaining_quantity) * Number(batch.unit_cost);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            تفاصيل الدُفعة
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-primary">{batch.display_code}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="المنتج" value={`${product.name} (${product.code})`} />
          <Field label="المخزن" value={`${warehouseName} (${warehouseCode})`} />
          <Field label="الوحدة" value={product.unit} />
          <Field label="تكلفة الوحدة" value={fmtNumber(Number(batch.unit_cost))} />
          <Field label="الكمية الأصلية" value={`${fmtQty(Number(batch.quantity))} ${product.unit}`} />
          <Field label="المتبقي" value={`${fmtQty(Number(batch.remaining_quantity))} ${product.unit}`} highlight />
          <Field label="المستهلك" value={`${fmtQty(consumed)} ${product.unit}`} />
          <Field label="إجمالي القيمة الحالية" value={fmtNumber(totalValue)} />
          <Field label="تاريخ الإنشاء" value={fmtDateTime(batch.created_at)} />
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">حركات الدُفعة</div>
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : movements.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground p-6">لا توجد حركات</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-end">الكمية</TableHead>
                    <TableHead className="text-end">التكلفة</TableHead>
                    <TableHead>الوصف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{fmtDateTime(m.movement_date)}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${m.movement_type === "in" ? "text-emerald-600" : m.movement_type === "out" ? "text-destructive" : ""}`}>
                          {MOVEMENT_TYPE_LABELS_AR[m.movement_type] ?? m.movement_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{fmtQty(Number(m.quantity))}</TableCell>
                      <TableCell className="text-end tabular-nums">{fmtNumber(Number(m.unit_cost))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.description ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="rounded-lg border bg-muted/30 p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-1 font-medium tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
  </div>
);

// avoid unused import warning if utils not extended
export const _silence = MOVEMENT_TYPE_LABELS_AR_FALLBACK;
