import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Loader2, Search, X, Eye, Check, XCircle, PauseCircle,
} from "lucide-react";
import type {
  InvoiceRequest, InvoiceRequestStatus, InventoryItem, Warehouse,
} from "@/lib/finhub-types";
import { INVOICE_REQUEST_STATUS_LABELS_AR, INVOICE_TYPE_LABELS_AR } from "@/lib/finhub-types";
import { fmtNumber, fmtDate } from "@/components/inventory/inventory-lib";

interface IRLine {
  id: string; request_id: string; item_id: string;
  quantity: number; unit_price: number; line_total: number;
  notes: string | null; line_order: number;
}
interface AccOpt { id: string; code: string; name: string; }

const STATUS_VARIANT: Record<InvoiceRequestStatus, "default" | "outline" | "destructive" | "secondary"> = {
  pending: "secondary", confirmed: "default", rejected: "destructive", on_hold: "secondary",
};

const InvoiceRequests = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canApprove = hasPermission("invoices.approve") || hasPermission("invoices.manage");

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<InvoiceRequest[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [accounts, setAccounts] = useState<AccOpt[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<InvoiceRequestStatus | "all">("pending");

  const [viewing, setViewing] = useState<InvoiceRequest | null>(null);
  const [viewingLines, setViewingLines] = useState<IRLine[]>([]);
  const [taxPct, setTaxPct] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rq, it, wh, ac] = await Promise.all([
      supabase.from("invoice_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("items").select("*"),
      supabase.from("warehouses").select("*"),
      supabase.from("accounts").select("id, code, name"),
    ]);
    setRequests((rq.data ?? []) as InvoiceRequest[]);
    setItems((it.data ?? []) as InventoryItem[]);
    setWarehouses((wh.data ?? []) as Warehouse[]);
    setAccounts((ac.data ?? []) as AccOpt[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (!q) return true;
      const wh = whMap.get(r.warehouse_id)?.name ?? "";
      return [r.request_number, r.notes ?? "", wh].join(" ").toLowerCase().includes(q);
    });
  }, [requests, search, tab, whMap]);

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === "pending").length,
    on_hold: requests.filter((r) => r.status === "on_hold").length,
    confirmed: requests.filter((r) => r.status === "confirmed").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  }), [requests]);

  const openView = async (r: InvoiceRequest) => {
    setViewing(r);
    setTaxPct(Number(r.tax_percent ?? 0));
    setDiscount(Number(r.discount_amount ?? 0));
    setNotes(r.notes ?? "");
    const { data } = await supabase
      .from("invoice_request_lines").select("*").eq("request_id", r.id).order("line_order");
    setViewingLines((data ?? []) as IRLine[]);
  };

  const subtotal = useMemo(
    () => viewingLines.reduce((s, l) => s + Number(l.line_total), 0),
    [viewingLines],
  );
  const taxAmt = useMemo(() => Math.round(subtotal * taxPct) / 100, [subtotal, taxPct]);
  const total = useMemo(() => subtotal + taxAmt - discount, [subtotal, taxAmt, discount]);

  const confirmReq = async () => {
    if (!viewing) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("confirm_invoice_request", {
      _request_id: viewing.id, _tax_percent: taxPct, _discount_amount: discount, _notes: notes || null,
    });
    setActionLoading(false);
    if (error) { toast({ title: "فشل التأكيد", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم تأكيد الفاتورة", description: "تم تحديث المخزون والقيود تلقائياً." });
    setViewing(null); load();
  };

  const rejectReq = async () => {
    if (!viewing) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("reject_invoice_request", {
      _request_id: viewing.id, _review_notes: notes || null,
    });
    setActionLoading(false);
    if (error) { toast({ title: "فشل الرفض", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم رفض الطلب" });
    setViewing(null); load();
  };

  const holdReq = async () => {
    if (!viewing) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("hold_invoice_request", {
      _request_id: viewing.id, _review_notes: notes || null,
    });
    setActionLoading(false);
    if (error) { toast({ title: "فشل التعليق", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم تعليق الطلب" });
    setViewing(null); load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <FileText className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">إدارة طلبات الفواتير</h1>
          <p className="text-sm text-muted-foreground">مراجعة الطلبات وإضافة الضرائب والخصومات قبل التأكيد.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الطلب..." className="pr-9 pl-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as InvoiceRequestStatus | "all")} dir="rtl">
        <TabsList>
          <TabsTrigger value="pending">في الانتظار <Badge variant="secondary" className="ml-2 mr-2">{counts.pending}</Badge></TabsTrigger>
          <TabsTrigger value="on_hold">معلق <Badge variant="outline" className="ml-2 mr-2">{counts.on_hold}</Badge></TabsTrigger>
          <TabsTrigger value="confirmed">مؤكد <Badge variant="outline" className="ml-2 mr-2">{counts.confirmed}</Badge></TabsTrigger>
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
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const wh = whMap.get(r.warehouse_id);
                      const ac = accMap.get(r.counterparty_account_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                          <TableCell className="text-sm">{fmtDate(r.request_date)}</TableCell>
                          <TableCell className="text-sm">{INVOICE_TYPE_LABELS_AR[r.invoice_type]}</TableCell>
                          <TableCell className="text-sm">{wh?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{ac ? `${ac.code} - ${ac.name}` : "—"}</TableCell>
                          <TableCell className="font-mono tabular-nums font-semibold">{fmtNumber(r.total_amount)}</TableCell>
                          <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{INVOICE_REQUEST_STATUS_LABELS_AR[r.status]}</Badge></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(r)}>
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
            <DialogTitle>طلب الفاتورة {viewing?.request_number}</DialogTitle>
            <DialogDescription>
              {viewing && INVOICE_TYPE_LABELS_AR[viewing.invoice_type]} • {viewing && fmtDate(viewing.request_date)}
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الصنف</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>سعر الوحدة</TableHead>
                      <TableHead>الإجمالي</TableHead>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {canApprove && (viewing.status === "pending" || viewing.status === "on_hold") ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>نسبة الضريبة %</Label>
                    <Input type="number" step="0.01" min="0" value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>قيمة الخصم</Label>
                    <Input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="font-mono" />
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الإجمالي قبل الضريبة:</span><span className="font-mono tabular-nums">{fmtNumber(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الضريبة:</span><span className="font-mono tabular-nums">{fmtNumber(taxAmt)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الخصم:</span><span className="font-mono tabular-nums">- {fmtNumber(discount)}</span></div>
                <div className="flex items-center justify-between border-t pt-1.5 font-bold"><span>الإجمالي النهائي:</span><span className="font-mono tabular-nums text-lg text-primary">{fmtNumber(total)}</span></div>
              </div>

              {canApprove && (viewing.status === "pending" || viewing.status === "on_hold") && (
                <div className="space-y-1.5">
                  <Label>ملاحظات (اختياري)</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setViewing(null)}>إغلاق</Button>
            {canApprove && viewing && (viewing.status === "pending" || viewing.status === "on_hold") && (
              <>
                <Button variant="destructive" onClick={rejectReq} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} رفض
                </Button>
                <Button variant="secondary" onClick={holdReq} disabled={actionLoading}>
                  <PauseCircle className="h-4 w-4" /> تعليق
                </Button>
                <Button onClick={confirmReq} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} تأكيد الفاتورة
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceRequests;
