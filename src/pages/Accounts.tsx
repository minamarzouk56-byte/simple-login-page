import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, Plus, Loader2, FolderTree } from "lucide-react";
import { ACCOUNT_TYPE_LABELS_AR, type Account, type AccountType, type Currency } from "@/lib/finhub-types";
import { cn } from "@/lib/utils";

interface TreeNode extends Account {
  children: TreeNode[];
}

const Accounts = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parentForNew, setParentForNew] = useState<Account | null>(null);

  const canCreate = hasPermission("accounts.create");

  const load = async () => {
    setLoading(true);
    const [{ data: accs, error }, { data: curs }] = await Promise.all([
      supabase.from("accounts").select("*").order("code"),
      supabase.from("currencies").select("*").order("code"),
    ]);
    if (error) {
      toast({ title: "خطأ في تحميل الحسابات", description: error.message, variant: "destructive" });
    } else {
      setAccounts((accs ?? []) as Account[]);
      // Auto-expand level 1
      setExpanded(new Set(((accs ?? []) as Account[]).filter((a) => a.level === 1).map((a) => a.id)));
    }
    setCurrencies((curs ?? []) as Currency[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tree = useMemo(() => buildTree(accounts), [accounts]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNewDialog = (parent: Account | null) => {
    setParentForNew(parent);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" /> شجرة الحسابات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            هيكل هرمي للحسابات بترميز تلقائي. لا يمكن حذف حساب يحتوي على أبناء أو حركات.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => openNewDialog(null)} className="gap-2">
            <Plus className="h-4 w-4" />
            حساب رئيسي جديد
          </Button>
        )}
      </header>

      <Card className="shadow-soft">
        <CardContent className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tree.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              لا توجد حسابات. شغّل ملف SQL أولاً ليتم زرع الحسابات الجذرية الـ 5.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  expanded={expanded}
                  onToggle={toggle}
                  onAddChild={openNewDialog}
                  canCreate={canCreate}
                  depth={0}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        parent={parentForNew}
        currencies={currencies}
        onCreated={load}
      />
    </div>
  );
};

function buildTree(items: Account[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  items.forEach((a) => map.set(a.id, { ...a, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.code.localeCompare(b.code));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

const TreeRow = ({
  node,
  expanded,
  onToggle,
  onAddChild,
  canCreate,
  depth,
}: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parent: Account) => void;
  canCreate: boolean;
  depth: number;
}) => {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 py-2.5 pe-3 transition-base hover:bg-muted/40 rounded-md",
        )}
        style={{ paddingInlineStart: `${depth * 24 + 12}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground",
            hasChildren ? "hover:bg-muted hover:text-foreground" : "opacity-30 cursor-default",
          )}
          aria-label={isOpen ? "طي" : "توسيع"}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </button>
        <span className="flex-1 truncate font-medium text-foreground">{node.name}</span>
        <Badge variant="outline" className="font-mono text-xs tabular-nums">{node.code}</Badge>
        <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
          {ACCOUNT_TYPE_LABELS_AR[node.type]}
        </Badge>
        {canCreate && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
            onClick={() => onAddChild(node)}
          >
            <Plus className="h-3.5 w-3.5 ms-1" /> فرع
          </Button>
        )}
      </div>
      {isOpen && hasChildren && (
        <ul>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              expanded={expanded}
              onToggle={onToggle}
              onAddChild={onAddChild}
              canCreate={canCreate}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const NewAccountDialog = ({
  open,
  onOpenChange,
  parent,
  currencies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parent: Account | null;
  currencies: Currency[];
  onCreated: () => void;
}) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [currency, setCurrency] = useState("EGP");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setNotes("");
      setType(parent?.account_type ?? "asset");
      setCurrency(parent?.currency_code ?? "EGP");
    }
  }, [open, parent]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "أدخل اسم الحساب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("accounts").insert({
      name_ar: name.trim(),
      account_type: type,
      parent_id: parent?.id ?? null,
      currency_code: currency,
      notes: notes.trim() || null,
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: "فشل إنشاء الحساب", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إنشاء الحساب بنجاح" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {parent ? `حساب فرعي تحت: ${parent.name_ar}` : "حساب رئيسي جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="acc-name">اسم الحساب</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: البنك الأهلي" />
          </div>

          {!parent && (
            <div className="space-y-2">
              <Label>نوع الحساب</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACCOUNT_TYPE_LABELS_AR) as [AccountType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>العملة</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name_ar} ({c.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-notes">ملاحظات (اختياري)</Label>
            <Textarea id="acc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <p className="text-xs text-muted-foreground">
            سيتم توليد كود الحساب تلقائياً بناءً على التسلسل الهرمي.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Accounts;
