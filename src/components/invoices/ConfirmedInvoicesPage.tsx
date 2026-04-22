import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Search, X, Eye, ReceiptText, ShoppingCart } from "lucide-react";
import type { Invoice, InvoiceType, InventoryItem, Warehouse } from "@/lib/finhub-types";
import { INVOICE_TYPE_LABELS_AR } from "@/lib/finhub-types";
import { fmtNumber, fmtDate } from "@/components/inventory/inventory-lib";

interface InvLine {
  id: string; invoice_id: string; item_id: string;
  quantity: number; unit_price: number; line_total: number;
  notes: string | null; line_order: number;
}
interface AccOpt { id: string; code: string; name: string; }

interface Props {
  /** main type and its return counterpart */
  primaryType: InvoiceType;
  returnType: InvoiceType;
  title: string;
  description: string;
}

export const ConfirmedInvoicesPage = ({ primaryType, returnType, title, description }: Props) => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [accounts, setAccounts] = useState<AccOpt[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"primary" | "returns" | "all">("primary");

  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [viewingLines, setViewingLines] = useState<InvLine[]>([]);

  const Icon = primaryType === "sale" ? ReceiptText : ShoppingCart;

  const load = async () => {
    setLoading(true);
    const [inv, it, wh, ac] = await Promise.all([
      supabase.from("invoices").select("*").in("invoice_type", [primaryType, returnType]).order("created_at", { ascending: false }),
      supabase.from("items").select("*"),
      supabase.from("warehouses").select("*"),
      supabase.from("accounts").select("id, code, name"),
    ]);
    setInvoices((inv.data ?? []) as Invoice[]);
    setItems((it.data ?? []) as InventoryItem[]);
    setWarehouses((wh.data ?? []) as Warehouse[]);
    setAccounts((ac.data ?? []) as AccOpt[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [primaryType, returnType]);

  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((v) => {
      if (tab === "primary" && v.invoice_type !== primaryType) return false;
      if (tab === "returns" && v.invoice_type !== returnType) return false;
      if (!q) return true;
      const wh = whMap.get(v.warehouse_id)?.name ?? "";
      return [v.invoice_number, wh, v.notes ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [invoices, search, tab, whMap, primaryType, returnType]);

  const counts = useMemo(() => ({
    primary: invoices.filter((v) => v.invoice_type === primaryType).length,
    returns: invoices.filter((v) => v.invoice_type === returnType).length,
    all: invoices.length,
  }), [invoices, primaryType, returnType]);

  const openView = async (v: Invoice) => {
    setViewing(v);
    const { data } = await supabase
      .from("invoice_lines").select("*").eq("invoice_id", v.id).order("line_order");
    setViewingLines((data ?? []) as InvLine[]);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
          <Icon className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الفاتورة..." className="pr-9 pl-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} dir="rtl">
        <TabsList>
          <TabsTrigger value="primary">{INVOICE_TYPE_LABELS_AR[primaryType]} <Badge variant="secondary" className="ml-2 mr-2">{counts.primary}</Badge></TabsTrigger>
          <TabsTrigger value="returns">{INVOICE_TYPE_LABELS_AR[returnType]} <Badge variant="outline" className="ml-2 mr-2">{counts.returns}</Badge></TabsTrigger>
          <TabsTrigger value="all">الكل <Badge variant="outline" className="ml-2 mr-2">{counts.all}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد فواتير</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الفاتورة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المخزن</TableHead>
                      <TableHead>الحساب المقابل</TableHead>
                      <TableHead>قبل الضريبة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v) => {
                      const wh = whMap.get(v.warehouse_id);
                      const ac = accMap.get(v.counterparty_account_id);
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">{v.invoice_number}</TableCell>
                          <TableCell className="text-sm">{fmtDate(v.invoice_date)}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant={v.invoice_type === primaryType ? "default" : "outline"}>
                              {INVOICE_TYPE_LABELS_AR[v.invoice_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{wh?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{ac ? `${ac.code} - ${ac.name}` : "—"}</TableCell>
                          <TableCell className="font-mono tabular-nums">{fmtNumber(v.subtotal)}</TableCell>
                          <TableCell className="font-mono tabular-nums font-semibold">{fmtNumber(v.total_amount)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(v)}>
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
            <DialogTitle>الفاتورة {viewing?.invoice_number}</DialogTitle>
            <DialogDescription>
              {viewing && INVOICE_TYPE_LABELS_AR[viewing.invoice_type]} • {viewing && fmtDate(viewing.invoice_date)}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">المخزن: </span>{whMap.get(viewing.warehouse_id)?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">الحساب: </span>
                  {(() => { const a = accMap.get(viewing.counterparty_account_id); return a ? `${a.code} - ${a.name}` : "—"; })()}
                </div>
              </div>

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

              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">قبل الضريبة:</span><span className="font-mono tabular-nums">{fmtNumber(viewing.subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الضريبة ({Number(viewing.tax_percent).toFixed(2)}%):</span><span className="font-mono tabular-nums">{fmtNumber(viewing.tax_amount)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الخصم:</span><span className="font-mono tabular-nums">- {fmtNumber(viewing.discount_amount)}</span></div>
                <div className="flex items-center justify-between border-t pt-1.5 font-bold"><span>الإجمالي:</span><span className="font-mono tabular-nums text-lg text-primary">{fmtNumber(viewing.total_amount)}</span></div>
              </div>

              {viewing.notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="text-muted-foreground mb-1">ملاحظات:</div>
                  {viewing.notes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
