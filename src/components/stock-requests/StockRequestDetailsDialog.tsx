import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import type { StockRequest, StockRequestLine, Product } from "@/lib/finhub-types";
import {
  STOCK_REQUEST_TYPE_LABELS_AR,
  STOCK_REQUEST_STATUS_LABELS_AR,
} from "@/lib/finhub-types";
import { fmtDate, fmtQty, fmtNumber } from "@/lib/inventory-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  request: StockRequest;
}

interface AllocationRow {
  request_line_id: string;
  batch_id: string;
  quantity: number;
  unit_cost: number;
  unit_price: number | null;
  batch_display_code: string | null;
}

export const StockRequestDetailsDialog = ({ open, onClose, request }: Props) => {
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<StockRequestLine[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [l, p] = await Promise.all([
        supabase.from("stock_request_lines").select("*").eq("request_id", request.id).order("line_order"),
        supabase.from("items").select("*"),
      ]);
      const ll = (l.data ?? []) as StockRequestLine[];
      setLines(ll);
      setProducts(new Map(((p.data ?? []) as Product[]).map((x) => [x.id, x])));

      if (ll.length > 0) {
        const allocR = await supabase
          .from("stock_request_allocations")
          .select("*, batches(display_code)")
          .in("request_line_id", ll.map((x) => x.id));
        const rows = ((allocR.data ?? []) as Array<{
          request_line_id: string; batch_id: string; quantity: number;
          unit_cost: number; unit_price: number | null;
          batches: { display_code: string | null } | null;
        }>).map((r) => ({
          request_line_id: r.request_line_id,
          batch_id: r.batch_id,
          quantity: Number(r.quantity),
          unit_cost: Number(r.unit_cost),
          unit_price: r.unit_price !== null ? Number(r.unit_price) : null,
          batch_display_code: r.batches?.display_code ?? null,
        }));
        setAllocations(rows);
      }
      setLoading(false);
    })();
  }, [open, request.id]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تفاصيل الطلب — {request.request_number}</DialogTitle>
          <DialogDescription>
            {STOCK_REQUEST_TYPE_LABELS_AR[request.request_type]} — {fmtDate(request.request_date)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">الحالة: </span>
                <Badge>{STOCK_REQUEST_STATUS_LABELS_AR[request.status]}</Badge>
              </div>
              {request.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">ملاحظات: </span>{request.notes}
                </div>
              )}
              {request.review_notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">ملاحظات المراجعة: </span>{request.review_notes}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">البنود المطلوبة</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead className="text-end">الكمية</TableHead>
                    <TableHead>ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const p = products.get(l.product_id);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{p?.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p?.code}</div>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {fmtQty(Number(l.quantity))} {p?.unit}
                        </TableCell>
                        <TableCell className="text-sm">{l.notes ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {allocations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">التخصيص على الدُفعات</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>كود الدفعة</TableHead>
                      <TableHead className="text-end">الكمية</TableHead>
                      <TableHead className="text-end">التكلفة</TableHead>
                      {allocations.some((a) => a.unit_price !== null) && <TableHead className="text-end">السعر</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((a, i) => {
                      const line = lines.find((l) => l.id === a.request_line_id);
                      const p = line ? products.get(line.product_id) : null;
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{p?.name ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{a.batch_display_code ?? "—"}</TableCell>
                          <TableCell className="text-end tabular-nums">{fmtQty(a.quantity)}</TableCell>
                          <TableCell className="text-end tabular-nums">{fmtNumber(a.unit_cost)}</TableCell>
                          {allocations.some((aa) => aa.unit_price !== null) && (
                            <TableCell className="text-end tabular-nums">
                              {a.unit_price !== null ? fmtNumber(a.unit_price) : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
