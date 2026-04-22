import { useEffect, useMemo, useState } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ListChecks, Loader2, Search, X, Eye, Wand2, XCircle,
  PackagePlus, PackageMinus, Undo2, RotateCcw,
} from "lucide-react";
import type { StockRequest, StockRequestType, StockRequestStatus, Customer, Supplier } from "@/lib/finhub-types";
import {
  STOCK_REQUEST_TYPE_LABELS_AR,
  STOCK_REQUEST_STATUS_LABELS_AR,
} from "@/lib/finhub-types";
import { fmtDate } from "@/lib/inventory-utils";
import { StockRequestDetailsDialog } from "@/components/stock-requests/StockRequestDetailsDialog";
import { SettleStockRequestDialog } from "@/components/stock-requests/SettleStockRequestDialog";

const TYPE_META: Record<StockRequestType, { icon: typeof PackagePlus; color: string }> = {
  add: { icon: PackagePlus, color: "text-emerald-600" },
  issue: { icon: PackageMinus, color: "text-blue-600" },
  sale_return: { icon: Undo2, color: "text-amber-600" },
  purchase_return: { icon: RotateCcw, color: "text-rose-600" },
};

const ManageStockRequests = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canSettle = hasPermission("stock_requests.settle") || hasPermission("stock_requests.manage");

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockRequestStatus | "all">("pending");
  const [typeFilter, setTypeFilter] = useState<StockRequestType | "all">("all");

  const [detailsTarget, setDetailsTarget] = useState<StockRequest | null>(null);
  const [settleTarget, setSettleTarget] = useState<StockRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StockRequest | null>(null);

  const load = async () => {
    setLoading(true);
    const [r, c, s] = await Promise.all([
      supabase.from("stock_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("*"),
      supabase.from("suppliers").select("*"),
    ]);
    setRequests((r.data ?? []) as StockRequest[]);
    setCustomers((c.data ?? []) as Customer[]);
    setSuppliers((s.data ?? []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const partnerName = (req: StockRequest) => {
    if (req.customer_id) return customers.find((c) => c.id === req.customer_id)?.name ?? "—";
    if (req.supplier_id) return suppliers.find((s) => s.id === req.supplier_id)?.name ?? "—";
    return "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.request_type !== typeFilter) return false;
      if (!q) return true;
      const partner = partnerName(r).toLowerCase();
      return r.request_number.toLowerCase().includes(q) || partner.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, search, statusFilter, typeFilter, customers, suppliers]);

  const reject = async () => {
    if (!rejectTarget) return;
    const { error } = await supabase.rpc("reject_stock_request", {
      _request_id: rejectTarget.id, _review_notes: null,
    });
    if (error) {
      toast({ title: "فشل الرفض", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم رفض الطلب" });
    setRejectTarget(null);
    load();
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "settled") return "default";
    if (s === "rejected" || s === "cancelled") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <ListChecks className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">إدارة طلبات المخزون</h1>
          <p className="text-sm text-muted-foreground">
            راجع طلبات المستخدمين، حدد الدُفعات والأسعار، ثم سوّي الطلب.
          </p>
        </div>
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
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {(Object.keys(STOCK_REQUEST_TYPE_LABELS_AR) as StockRequestType[]).map((t) => (
              <SelectItem key={t} value={t}>{STOCK_REQUEST_TYPE_LABELS_AR[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد المراجعة</SelectItem>
            <SelectItem value="settled">تمت التسوية</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد طلبات</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الطرف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-64">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => {
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
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setDetailsTarget(req)}>
                            <Eye className="h-3.5 w-3.5" />تفاصيل
                          </Button>
                          {req.status === "pending" && canSettle && (
                            <>
                              <Button size="sm" onClick={() => setSettleTarget(req)}>
                                <Wand2 className="h-3.5 w-3.5" />تسوية
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                onClick={() => setRejectTarget(req)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
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

      {detailsTarget && (
        <StockRequestDetailsDialog
          open={!!detailsTarget}
          onClose={() => setDetailsTarget(null)}
          request={detailsTarget}
        />
      )}

      {settleTarget && (
        <SettleStockRequestDialog
          open={!!settleTarget}
          onClose={() => setSettleTarget(null)}
          onDone={load}
          request={settleTarget}
        />
      )}

      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>رفض الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم وضع الطلب {rejectTarget?.request_number} في حالة "مرفوض".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={reject} className="bg-destructive text-destructive-foreground">
              تأكيد الرفض
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageStockRequests;
