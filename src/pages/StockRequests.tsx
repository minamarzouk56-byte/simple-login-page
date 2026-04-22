import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PackagePlus, PackageMinus, Undo2, RotateCcw, ClipboardList,
  Loader2, Trash2, Eye,
} from "lucide-react";
import type { StockRequest, StockRequestType, Customer, Supplier } from "@/lib/finhub-types";
import {
  STOCK_REQUEST_TYPE_LABELS_AR,
  STOCK_REQUEST_STATUS_LABELS_AR,
} from "@/lib/finhub-types";
import { fmtDate } from "@/lib/inventory-utils";
import { StockRequestFormDialog } from "@/components/stock-requests/StockRequestFormDialog";
import { StockRequestDetailsDialog } from "@/components/stock-requests/StockRequestDetailsDialog";

const TYPE_META: Record<StockRequestType, { icon: typeof PackagePlus; color: string }> = {
  add: { icon: PackagePlus, color: "text-emerald-600" },
  issue: { icon: PackageMinus, color: "text-blue-600" },
  sale_return: { icon: Undo2, color: "text-amber-600" },
  purchase_return: { icon: RotateCcw, color: "text-rose-600" },
};

const StockRequests = () => {
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [dialogType, setDialogType] = useState<StockRequestType | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<StockRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockRequest | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [r, c, s] = await Promise.all([
      supabase.from("stock_requests").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("customers").select("*"),
      supabase.from("suppliers").select("*"),
    ]);
    setRequests((r.data ?? []) as StockRequest[]);
    setCustomers((c.data ?? []) as Customer[]);
    setSuppliers((s.data ?? []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const partnerName = (req: StockRequest) => {
    if (req.customer_id) return customers.find((c) => c.id === req.customer_id)?.name ?? "—";
    if (req.supplier_id) return suppliers.find((s) => s.id === req.supplier_id)?.name ?? "—";
    return "—";
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "settled") return "default";
    if (s === "rejected" || s === "cancelled") return "destructive";
    return "outline";
  };

  const cancelRequest = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("stock_requests").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "فشل الإلغاء", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إلغاء الطلب" });
    setDeleteTarget(null);
    load();
  };

  const canCreate = hasPermission("stock_requests.create");

  const typeButtons: { type: StockRequestType; label: string }[] = [
    { type: "add", label: STOCK_REQUEST_TYPE_LABELS_AR.add },
    { type: "issue", label: STOCK_REQUEST_TYPE_LABELS_AR.issue },
    { type: "sale_return", label: STOCK_REQUEST_TYPE_LABELS_AR.sale_return },
    { type: "purchase_return", label: STOCK_REQUEST_TYPE_LABELS_AR.purchase_return },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <ClipboardList className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">طلبات إذن المخزون</h1>
          <p className="text-sm text-muted-foreground">
            أنشئ طلب لإضافة أو صرف مخزون أو إرجاع، وتابع حالته في تبويب طلباتي.
          </p>
        </div>
      </div>

      {canCreate && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {typeButtons.map(({ type, label }) => {
                const Meta = TYPE_META[type];
                return (
                  <Button key={type} variant="outline" className="h-auto py-4 flex-col gap-2"
                    onClick={() => setDialogType(type)}>
                    <Meta.icon className={`h-6 w-6 ${Meta.color}`} />
                    <span className="text-sm font-medium">{label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <h2 className="font-display text-lg font-semibold">طلباتي المرسلة</h2>
            <p className="text-xs text-muted-foreground">{requests.length} طلب</p>
          </div>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لم تنشئ أي طلبات بعد</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الطرف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const Meta = TYPE_META[req.request_type];
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs">{req.request_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Meta.icon className={`h-4 w-4 ${Meta.color}`} />
                          <span className="text-sm">{STOCK_REQUEST_TYPE_LABELS_AR[req.request_type]}</span>
                        </div>
                      </TableCell>
                      <TableCell>{fmtDate(req.request_date)}</TableCell>
                      <TableCell>{partnerName(req)}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(req.status)}>{STOCK_REQUEST_STATUS_LABELS_AR[req.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailsTarget(req)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {req.status === "pending" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteTarget(req)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dialogType && (
        <StockRequestFormDialog
          open={!!dialogType}
          onClose={() => setDialogType(null)}
          onSaved={load}
          requestType={dialogType}
        />
      )}

      {detailsTarget && (
        <StockRequestDetailsDialog
          open={!!detailsTarget}
          onClose={() => setDetailsTarget(null)}
          request={detailsTarget}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الطلب {deleteTarget?.request_number} نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={cancelRequest} className="bg-destructive text-destructive-foreground">
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockRequests;
