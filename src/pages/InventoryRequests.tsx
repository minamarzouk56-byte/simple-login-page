import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ClipboardCheck, Loader2, Search, X, Eye, Check, XCircle, PauseCircle, FileText,
  ArrowUpFromLine, ArrowDownToLine, Undo2, Redo2,
} from "lucide-react";
import type {
  InventoryPermit, InventoryPermitLine, InventoryItem, Warehouse, PermitStatus,
} from "@/lib/finhub-types";
import { PERMIT_STATUS_LABELS_AR, PERMIT_TYPE_LABELS_AR } from "@/lib/finhub-types";
import { fmtNumber, fmtDate } from "@/components/inventory/inventory-lib";

interface AccountOpt { id: string; code: string; name: string; }
interface ProfileOpt { user_id: string; full_name: string | null; }

const STATUS_VARIANT: Record<PermitStatus, "default" | "outline" | "destructive" | "secondary"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
  on_hold: "secondary",
  invoiced: "default",
};

const InventoryRequests = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canApprove = hasPermission("inventory.approve");

  const [loading, setLoading] = useState(true);
  const [permits, setPermits] = useState<InventoryPermit[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PermitStatus | "all">("pending");

  const [viewing, setViewing] = useState<InventoryPermit | null>(null);
  const [viewingLines, setViewingLines] = useState<InventoryPermitLine[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pm, it, wh, ac, pr] = await Promise.all([
      supabase.from("inventory_permits").select("*").order("created_at", { ascending: false }),
      supabase.from("items").select("*"),
      supabase.from("warehouses").select("*"),
      supabase.from("accounts").select("id, code, name"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setPermits((pm.data ?? []) as InventoryPermit[]);
    setItems((it.data ?? []) as InventoryItem[]);
    setWarehouses((wh.data ?? []) as Warehouse[]);
    setAccounts((ac.data ?? []) as AccountOpt[]);
    setProfiles((pr.data ?? []) as ProfileOpt[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const profMap = useMemo(() => new Map(profiles.map((p) => [p.user_id, p.full_name ?? "—"])), [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permits.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      if (!q) return true;
      const wh = whMap.get(p.warehouse_id)?.name ?? "";
      return [p.permit_number, p.description ?? "", wh, profMap.get(p.requested_by) ?? ""]
        .join(" ").toLowerCase().includes(q);
    });
  }, [permits, search, tab, whMap, profMap]);

  const counts = useMemo(() => ({
    pending: permits.filter((p) => p.status === "pending").length,
    approved: permits.filter((p) => p.status === "approved").length,
    rejected: permits.filter((p) => p.status === "rejected").length,
    all: permits.length,
  }), [permits]);

  const openView = async (p: InventoryPermit) => {
    setViewing(p);
    setReviewNotes(p.review_notes ?? "");
    const { data } = await supabase
      .from("inventory_permit_lines").select("*").eq("permit_id", p.id).order("line_order");
    setViewingLines((data ?? []) as InventoryPermitLine[]);
  };

  const approve = async () => {
    if (!viewing) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("approve_inventory_permit", {
      _permit_id: viewing.id, _review_notes: reviewNotes || null,
    });
    setActionLoading(false);
    if (error) { toast({ title: "فشل الموافقة", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تمت الموافقة", description: "تم إنشاء قيد محاسبي وتحديث الرصيد." });
    setViewing(null);
    load();
  };

  const reject = async () => {
    if (!viewing) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("reject_inventory_permit", {
      _permit_id: viewing.id, _review_notes: reviewNotes || null,
    });
    setActionLoading(false);
    if (error) { toast({ title: "فشل الرفض", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم رفض الطلب" });
    setViewing(null);
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <ClipboardCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">إدارة الطلبات</h1>
          <p className="text-sm text-muted-foreground">مراجعة طلبات أذونات الصرف والوارد والموافقة عليها أو رفضها.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الطلب أو الوصف..." className="pr-9 pl-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PermitStatus | "all")} dir="rtl">
        <TabsList>
          <TabsTrigger value="pending">في الانتظار <Badge variant="secondary" className="ml-2 mr-2">{counts.pending}</Badge></TabsTrigger>
          <TabsTrigger value="approved">تمت الموافقة <Badge variant="outline" className="ml-2 mr-2">{counts.approved}</Badge></TabsTrigger>
          <TabsTrigger value="rejected">مرفوض <Badge variant="outline" className="ml-2 mr-2">{counts.rejected}</Badge></TabsTrigger>
          <TabsTrigger value="all">الكل <Badge variant="outline" className="ml-2 mr-2">{counts.all}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد طلبات</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المخزن</TableHead>
                      <TableHead>الحساب المقابل</TableHead>
                      <TableHead>مقدّم الطلب</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const wh = whMap.get(p.warehouse_id);
                      const ac = p.counterparty_account_id ? accMap.get(p.counterparty_account_id) : null;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.permit_number}</TableCell>
                          <TableCell className="text-sm">{fmtDate(p.permit_date)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              {p.permit_type === "issue"
                                ? <ArrowUpFromLine className="h-3.5 w-3.5 text-destructive" />
                                : <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />}
                              {PERMIT_TYPE_LABELS_AR[p.permit_type]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{wh?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{ac ? `${ac.code} - ${ac.name}` : "—"}</TableCell>
                          <TableCell className="text-sm">{profMap.get(p.requested_by) ?? "—"}</TableCell>
                          <TableCell className="font-mono tabular-nums font-semibold">{fmtNumber(p.total_amount)}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[p.status]}>{PERMIT_STATUS_LABELS_AR[p.status]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(p)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب {viewing?.permit_number}</DialogTitle>
            <DialogDescription>
              {viewing && PERMIT_TYPE_LABELS_AR[viewing.permit_type]} • {viewing && fmtDate(viewing.permit_date)}
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">المخزن: </span>{whMap.get(viewing.warehouse_id)?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">مقدّم الطلب: </span>{profMap.get(viewing.requested_by) ?? "—"}</div>
                <div><span className="text-muted-foreground">الحالة: </span>
                  <Badge variant={STATUS_VARIANT[viewing.status]}>{PERMIT_STATUS_LABELS_AR[viewing.status]}</Badge>
                </div>
                <div className="col-span-full">
                  <span className="text-muted-foreground">الحساب المقابل: </span>
                  {viewing.counterparty_account_id
                    ? (() => { const a = accMap.get(viewing.counterparty_account_id!); return a ? `${a.code} - ${a.name}` : "—"; })()
                    : "—"}
                </div>
                {viewing.description && <div className="col-span-full"><span className="text-muted-foreground">وصف: </span>{viewing.description}</div>}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>سعر الوحدة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingLines.map((l) => {
                      const it = itemMap.get(l.item_id);
                      return (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{it?.name ?? "—"}</div>
                            <div className="font-mono text-xs text-muted-foreground">{it?.code}</div>
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">{fmtNumber(l.quantity)} <span className="text-xs text-muted-foreground">{it?.unit}</span></TableCell>
                          <TableCell className="font-mono tabular-nums">{fmtNumber(l.unit_price)}</TableCell>
                          <TableCell className="font-mono tabular-nums font-semibold">{fmtNumber(l.line_total)}</TableCell>
                          <TableCell className="text-sm">{l.notes ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t p-3 bg-muted/30">
                  <span className="text-sm text-muted-foreground">الإجمالي</span>
                  <span className="font-mono tabular-nums text-lg font-bold">{fmtNumber(viewing.total_amount)}</span>
                </div>
              </div>

              {canApprove && viewing.status === "pending" && (
                <div className="space-y-1.5">
                  <Label>ملاحظات المراجعة (اختياري)</Label>
                  <Textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                </div>
              )}

              {viewing.status !== "pending" && viewing.review_notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="text-muted-foreground mb-1">ملاحظات المراجعة:</div>
                  {viewing.review_notes}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>إغلاق</Button>
            {canApprove && viewing?.status === "pending" && (
              <>
                <Button variant="destructive" onClick={reject} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  رفض
                </Button>
                <Button onClick={approve} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  موافقة
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryRequests;
