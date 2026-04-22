import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShoppingCart, Plus, Loader2, Search, X, MoreHorizontal,
  CheckCircle2, Layers, FileCheck, XCircle, Pencil, ReceiptText,
} from "lucide-react";
import type { Order, OrderType, OrderStatus, Customer, Supplier } from "@/lib/finhub-types";
import { ORDER_STATUS_LABELS_AR, ORDER_TYPE_LABELS_AR } from "@/lib/finhub-types";
import { OrderFormDialog } from "@/components/orders/OrderFormDialog";
import { PurchaseApproveDialog } from "@/components/orders/PurchaseApproveDialog";
import { SaleAllocateDialog } from "@/components/orders/SaleAllocateDialog";
import { SaleCompleteDialog } from "@/components/orders/SaleCompleteDialog";
import { fmtDate, fmtNumber } from "@/lib/inventory-utils";

const statusColor = (s: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "completed": return "default";
    case "rejected":
    case "cancelled": return "destructive";
    case "allocated":
    case "approved": return "secondary";
    default: return "outline";
  }
};

interface Props {
  /** "purchase" => purchase + sale_return tabs; "sale" => sale + purchase_return */
  scope: "purchase" | "sale";
}

const Orders = ({ scope: scopeProp }: Props) => {
  const { scope: scopeRoute } = useParams<{ scope: "purchase" | "sale" }>();
  const scope = scopeRoute ?? scopeProp;

  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canApprove = hasPermission("invoices.approve") || hasPermission("invoices.manage");

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<OrderType>(scope === "purchase" ? "purchase" : "sale");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [approveTarget, setApproveTarget] = useState<Order | null>(null);
  const [allocateTarget, setAllocateTarget] = useState<Order | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Order | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);

  const types: OrderType[] = scope === "purchase" ? ["purchase", "sale_return"] : ["sale", "purchase_return"];

  const load = async () => {
    setLoading(true);
    const [o, c, s] = await Promise.all([
      supabase.from("orders").select("*").in("order_type", types).order("created_at", { ascending: false }),
      supabase.from("customers").select("*"),
      supabase.from("suppliers").select("*"),
    ]);
    setOrders((o.data ?? []) as Order[]);
    setCustomers((c.data ?? []) as Customer[]);
    setSuppliers((s.data ?? []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scope]);

  const partnerName = (o: Order) => {
    if (o.customer_id) return customers.find((c) => c.id === o.customer_id)?.name ?? "—";
    if (o.supplier_id) return suppliers.find((c) => c.id === o.supplier_id)?.name ?? "—";
    return "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      const partner = partnerName(o).toLowerCase();
      return o.order_number.toLowerCase().includes(q) || partner.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, search, statusFilter, customers, suppliers]);

  const reject = async () => {
    if (!rejectTarget) return;
    const { error } = await supabase.rpc("reject_order", { _order_id: rejectTarget.id, _review_notes: null });
    if (error) {
      toast({ title: "فشل الرفض", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم رفض الطلب" });
    setRejectTarget(null);
    load();
  };

  const isPurchaseScope = scope === "purchase";

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
            {isPurchaseScope ? <ShoppingCart className="h-6 w-6 text-primary-foreground" /> : <ReceiptText className="h-6 w-6 text-primary-foreground" />}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">
              {isPurchaseScope ? "طلبات الشراء" : "طلبات البيع"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isPurchaseScope
                ? "إنشاء طلبات الشراء واعتمادها لإنشاء الدُفعات"
                : "إنشاء طلبات البيع، تخصيص الدُفعات، وتأكيد الفاتورة"}
            </p>
          </div>
        </div>
        {hasPermission("invoices.manage") && (
          <div className="flex gap-2">
            <Button onClick={() => { setEditingOrder(null); setCreateType(types[0]); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />{ORDER_TYPE_LABELS_AR[types[0]]}
            </Button>
            <Button variant="outline" onClick={() => { setEditingOrder(null); setCreateType(types[1]); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />{ORDER_TYPE_LABELS_AR[types[1]]}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الطلب أو الطرف..." className="pr-9 pl-9" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {(Object.keys(ORDER_STATUS_LABELS_AR) as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS_AR[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد طلبات</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>{isPurchaseScope ? "المورد" : "العميل"}</TableHead>
                  <TableHead className="text-end">الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>{ORDER_TYPE_LABELS_AR[o.order_type]}</TableCell>
                    <TableCell>{fmtDate(o.order_date)}</TableCell>
                    <TableCell>{partnerName(o)}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmtNumber(Number(o.total_amount))}</TableCell>
                    <TableCell><Badge variant={statusColor(o.status)}>{ORDER_STATUS_LABELS_AR[o.status]}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(o.status === "draft" || o.status === "pending") && hasPermission("invoices.manage") && (
                            <DropdownMenuItem onClick={() => { setEditingOrder(o); setCreateType(o.order_type); setCreateOpen(true); }}>
                              <Pencil className="h-4 w-4 ml-2" />تعديل
                            </DropdownMenuItem>
                          )}
                          {/* Purchase: approve creates batches & journal */}
                          {(o.order_type === "purchase" || o.order_type === "sale_return") &&
                            (o.status === "pending" || o.status === "draft") && canApprove && (
                              <DropdownMenuItem onClick={() => setApproveTarget(o)}>
                                <CheckCircle2 className="h-4 w-4 ml-2" />اعتماد ونشر
                              </DropdownMenuItem>
                            )}
                          {/* Sale: allocate batches */}
                          {(o.order_type === "sale" || o.order_type === "purchase_return") &&
                            (o.status === "pending" || o.status === "approved" || o.status === "allocated") && canApprove && (
                              <DropdownMenuItem onClick={() => setAllocateTarget(o)}>
                                <Layers className="h-4 w-4 ml-2" />
                                {o.status === "allocated" ? "إعادة تخصيص" : "تخصيص الدُفعات"}
                              </DropdownMenuItem>
                            )}
                          {/* Sale: complete after allocation */}
                          {(o.order_type === "sale" || o.order_type === "purchase_return") &&
                            o.status === "allocated" && canApprove && (
                              <DropdownMenuItem onClick={() => setCompleteTarget(o)}>
                                <FileCheck className="h-4 w-4 ml-2" />تأكيد ونشر القيد
                              </DropdownMenuItem>
                            )}
                          {/* Reject */}
                          {(o.status === "pending" || o.status === "draft" || o.status === "approved" || o.status === "allocated") && canApprove && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setRejectTarget(o)}>
                              <XCircle className="h-4 w-4 ml-2" />رفض
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
        defaultType={createType}
        editing={editingOrder}
      />
      {approveTarget && (
        <PurchaseApproveDialog
          open={!!approveTarget}
          onClose={() => setApproveTarget(null)}
          onDone={load}
          order={approveTarget}
        />
      )}
      {allocateTarget && (
        <SaleAllocateDialog
          open={!!allocateTarget}
          onClose={() => setAllocateTarget(null)}
          onDone={load}
          order={allocateTarget}
        />
      )}
      {completeTarget && (
        <SaleCompleteDialog
          open={!!completeTarget}
          onClose={() => setCompleteTarget(null)}
          onDone={load}
          order={completeTarget}
        />
      )}

      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>رفض الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم وضع الطلب {rejectTarget?.order_number} في حالة "مرفوض".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={reject} className="bg-destructive text-destructive-foreground">رفض</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orders;
