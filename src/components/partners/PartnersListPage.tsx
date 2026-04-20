import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2, MoreHorizontal, FileText, Pencil, Trash2, Search, X, type LucideIcon } from "lucide-react";
import type { Customer, AppPermission } from "@/lib/finhub-types";
import { PartnerFormDialog } from "./PartnerFormDialog";
import { PartnerStatementDialog } from "./PartnerStatementDialog";

interface Props {
  kind: "customer" | "supplier";
  title: string;
  description: string;
  Icon: LucideIcon;
  newButtonLabel: string;
}

export const PartnersListPage = ({ kind, title, description, Icon, newButtonLabel }: Props) => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Customer[]>([]);
  const [movements, setMovements] = useState<Record<string, number>>({});
  const [currencies, setCurrencies] = useState<Record<string, { name_ar: string; symbol: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [statementPartner, setStatementPartner] = useState<Customer | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<Customer | null>(null);

  const table = kind === "customer" ? "customers" : "suppliers";
  const fkColumn = kind === "customer" ? "customer_id" : "supplier_id";
  const permPrefix = kind === "customer" ? "customers" : "suppliers";

  const canCreate = hasPermission(`${permPrefix}.create` as AppPermission);
  const canEdit = hasPermission(`${permPrefix}.edit` as AppPermission);
  const canDelete = hasPermission(`${permPrefix}.delete` as AppPermission);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: curs }] = await Promise.all([
      supabase.from(table).select("*").order("code"),
      supabase.from("currencies").select("code, name_ar, symbol"),
    ]);
    if (error) {
      toast({ title: "فشل التحميل", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as Customer[];
    setItems(list);
    const cmap: Record<string, { name_ar: string; symbol: string }> = {};
    (curs ?? []).forEach((c: any) => { cmap[c.code] = { name_ar: c.name_ar, symbol: c.symbol }; });
    setCurrencies(cmap);

    const ids = list.map((p) => p.id);
    if (ids.length) {
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select(`${fkColumn}, debit, credit`)
        .in(fkColumn, ids);
      const map: Record<string, number> = {};
      (lines ?? []).forEach((l: any) => {
        const pid = l[fkColumn];
        if (!pid) return;
        map[pid] = (map[pid] ?? 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0);
      });
      setMovements(map);
    } else {
      setMovements({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const fmt = (n: number) => n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Customer) => { setEditing(p); setFormOpen(true); };

  const handleDelete = async () => {
    if (!deletingPartner) return;
    const { error } = await supabase.from(table).delete().eq("id", deletingPartner.id);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حذف الحساب" });
      load();
    }
    setDeletingPartner(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Icon className="h-6 w-6 text-primary" /> {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {canCreate && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> {newButtonLabel}
          </Button>
        )}
      </header>

      <div className="relative max-w-md">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم، الكود، الهاتف أو البريد..."
          className="pe-9 ps-9"
        />
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch("")}
            className="absolute start-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {search ? "لا توجد نتائج مطابقة." : "لا توجد بيانات."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الكود</th>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-center font-medium">عملة الحساب</th>
                    <th className="px-4 py-3 text-end font-medium">حد الائتمان</th>
                    <th className="px-4 py-3 text-end font-medium">الرصيد</th>
                    <th className="px-4 py-3 text-end font-medium w-32">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const balance = (Number(p.opening_balance) || 0) + (movements[p.id] ?? 0);
                    const cur = currencies[p.currency];
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-base">
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">{p.code}</td>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium">
                            <span className="font-mono text-muted-foreground">{p.currency}</span>
                            <span>{cur?.name_ar ?? "—"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">
                          {Number(p.credit_limit) > 0 ? fmt(Number(p.credit_limit)) : "—"}
                        </td>
                        <td
                          className={
                            "px-4 py-3 text-end tabular-nums font-semibold " +
                            (balance > 0
                              ? "text-success"
                              : balance < 0
                              ? "text-destructive"
                              : "text-muted-foreground")
                          }
                        >
                          {fmt(balance)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => setStatementPartner(p)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              كشف حساب
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {canEdit && (
                                  <DropdownMenuItem onClick={() => openEdit(p)}>
                                    <Pencil className="h-4 w-4" />
                                    <span>تعديل البيانات</span>
                                  </DropdownMenuItem>
                                )}
                                {canEdit && canDelete && <DropdownMenuSeparator />}
                                {canDelete && (
                                  <DropdownMenuItem
                                    onClick={() => setDeletingPartner(p)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>حذف الحساب</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PartnerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        partner={editing}
        kind={kind}
        onSaved={load}
      />

      <PartnerStatementDialog
        partner={statementPartner}
        kind={kind}
        onOpenChange={(v) => !v && setStatementPartner(null)}
      />

      <AlertDialog open={!!deletingPartner} onOpenChange={(v) => !v && setDeletingPartner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <span className="font-semibold">{deletingPartner?.name}</span>؟
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
