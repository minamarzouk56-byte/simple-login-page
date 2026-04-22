import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FilePlus2, ArrowUpFromLine, ArrowDownToLine, Undo2, Redo2,
  Inbox, Loader2, ChevronLeft,
} from "lucide-react";
import type { InventoryPermit, PermitType, PermitStatus } from "@/lib/finhub-types";
import {
  PERMIT_TYPE_LABELS_AR, PERMIT_STATUS_LABELS_AR,
} from "@/lib/finhub-types";
import { fmtNumber, fmtDate } from "@/components/inventory/inventory-lib";

const STATUS_VARIANT: Record<PermitStatus, "default" | "outline" | "destructive" | "secondary"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
  on_hold: "secondary",
  invoiced: "default",
};

const TYPE_CARDS: { type: PermitType; icon: typeof ArrowUpFromLine; tone: string }[] = [
  { type: "issue", icon: ArrowUpFromLine, tone: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700 dark:text-rose-300" },
  { type: "receive", icon: ArrowDownToLine, tone: "from-primary/15 to-primary/5 border-primary/30 text-primary" },
  { type: "sales_return", icon: Undo2, tone: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-300" },
  { type: "purchase_return", icon: Redo2, tone: "from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-700 dark:text-violet-300" },
];

const InventoryNewRequest = () => {
  const { user, hasPermission } = useAuth();
  const canRequest = hasPermission("inventory.request");

  const [myPermits, setMyPermits] = useState<InventoryPermit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("inventory_permits").select("*")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMyPermits((data ?? []) as InventoryPermit[]);
        setLoading(false);
      });
  }, [user]);

  const counts = useMemo(() => ({
    pending: myPermits.filter((p) => p.status === "pending" || p.status === "on_hold").length,
    approved: myPermits.filter((p) => p.status === "approved" || p.status === "invoiced").length,
    rejected: myPermits.filter((p) => p.status === "rejected").length,
  }), [myPermits]);

  if (!canRequest) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        ليس لديك صلاحية تقديم طلبات إذن.
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <FilePlus2 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">طلب إذن جديد</h1>
          <p className="text-sm text-muted-foreground">اختر نوع الإذن لبدء طلب جديد، أو راجع طلباتك السابقة.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TYPE_CARDS.map(({ type, icon: Icon, tone }) => (
          <Link key={type} to={`/inventory/new-request/${type}`}>
            <Card className={`bg-gradient-to-br ${tone} border-2 hover:scale-[1.02] hover:shadow-lg transition-base cursor-pointer h-full`}>
              <CardContent className="p-5 flex flex-col items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-background/60 flex items-center justify-center">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-display text-lg font-bold">{PERMIT_TYPE_LABELS_AR[type]}</div>
                  <p className="text-xs opacity-80 mt-1">
                    {type === "issue" && "صرف أصناف من المخزن لعميل أو جهة"}
                    {type === "receive" && "استلام أصناف جديدة من مورد"}
                    {type === "sales_return" && "إرجاع أصناف تم بيعها للعميل"}
                    {type === "purchase_return" && "إرجاع أصناف للمورد"}
                  </p>
                </div>
                <div className="text-xs flex items-center gap-1 opacity-90 mt-auto">
                  ابدأ الطلب <ChevronLeft className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* My requests */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Inbox className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">طلباتي المرسلة</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-secondary-foreground/40" /> في الانتظار: <b className="tabular-nums">{counts.pending}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> معتمد: <b className="tabular-nums">{counts.approved}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" /> مرفوض: <b className="tabular-nums">{counts.rejected}</b>
              </span>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : myPermits.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لم تقم بإرسال أي طلبات بعد</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>ملاحظات المراجعة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPermits.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.permit_number}</TableCell>
                    <TableCell className="text-sm">{PERMIT_TYPE_LABELS_AR[p.permit_type]}</TableCell>
                    <TableCell className="text-sm">{fmtDate(p.permit_date)}</TableCell>
                    <TableCell className="font-mono tabular-nums font-semibold">{fmtNumber(p.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status]}>{PERMIT_STATUS_LABELS_AR[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={p.review_notes ?? ""}>
                      {p.review_notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryNewRequest;
