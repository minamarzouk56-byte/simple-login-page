import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Shield,
  Plus,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  MoreHorizontal,
  KeyRound,
  Trash2,
  Pencil,
  ShieldCheck,
  Search,
} from "lucide-react";
import {
  PERMISSION_LABELS_AR,
  type AppPermission,
  type Profile,
  type UserPermission,
} from "@/lib/finhub-types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------
// Permission groups — mirror the sidebar 1:1.
// Each group represents a sidebar page. The "view" permission gates
// access to the page; child permissions are page-specific actions and
// require the parent view to be enabled.
// ---------------------------------------------------------------------
interface PermissionGroup {
  key: string;
  label: string;
  view: AppPermission; // parent gate — required for any child action
  children: AppPermission[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "dashboard",
    label: "لوحة التحكم",
    view: "dashboard.view",
    children: [],
  },
  {
    key: "accounts",
    label: "شجرة الحسابات",
    view: "accounts.view",
    children: ["accounts.create", "accounts.edit", "accounts.delete"],
  },
  {
    key: "journal",
    label: "القيود اليومية",
    view: "journal.view",
    children: ["journal.create", "journal.edit", "journal.delete"],
  },
  {
    key: "partners",
    label: "العملاء والموردين",
    view: "partners.view",
    children: ["partners.create", "partners.edit", "partners.delete"],
  },
  {
    key: "reports",
    label: "التقارير المالية",
    view: "reports.view",
    children: [],
  },
  {
    key: "users",
    label: "المستخدمون والصلاحيات",
    view: "users.manage",
    children: [],
  },
  {
    key: "settings",
    label: "الإعدادات",
    view: "settings.manage",
    children: [],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => [g.view, ...g.children]) as AppPermission[];

const Users = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permsByUser, setPermsByUser] = useState<Map<string, Set<AppPermission>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [permsTarget, setPermsTarget] = useState<Profile | null>(null);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profs, error: pErr }, { data: perms, error: prmErr }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_permissions").select("*"),
    ]);
    if (pErr || prmErr) {
      toast({ title: "فشل التحميل", description: (pErr ?? prmErr)?.message, variant: "destructive" });
    }
    setProfiles((profs ?? []) as Profile[]);
    const map = new Map<string, Set<AppPermission>>();
    ((perms ?? []) as UserPermission[]).forEach((p) => {
      if (!map.has(p.user_id)) map.set(p.user_id, new Set());
      map.get(p.user_id)!.add(p.permission);
    });
    setPermsByUser(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.job_title ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> المستخدمون والصلاحيات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أدر المستخدمين وصلاحياتهم. الصلاحيات منظَّمة في أقسام رئيسية مع صلاحيات فرعية.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> مستخدم جديد
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو المسمى الوظيفي..."
              className="ps-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              لا يوجد مستخدمون مطابقون.
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">المسمى الوظيفي</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">الصلاحيات</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const isMe = p.user_id === currentUser?.id;
                    const count = permsByUser.get(p.user_id)?.size ?? 0;
                    return (
                      <TableRow key={p.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-semibold text-sm shrink-0">
                              {(p.full_name ?? "?").charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{p.full_name ?? "—"}</span>
                                {isMe && <Badge variant="outline" className="text-xs">أنت</Badge>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                          {p.job_title ?? "—"}
                        </TableCell>
                        <TableCell>
                          {p.is_admin ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/15 gap-1">
                              <ShieldCheck className="h-3 w-3" /> مسؤول
                            </Badge>
                          ) : (
                            <Badge variant="secondary">مستخدم</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.is_admin ? (
                            <span className="text-xs text-muted-foreground">جميع الصلاحيات</span>
                          ) : (
                            <span className="text-sm tabular-nums">
                              {count} <span className="text-muted-foreground">/ {ALL_PERMISSIONS.length}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-60 group-hover:opacity-100"
                                aria-label="إجراءات"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                {p.full_name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setPermsTarget(p)}
                                disabled={p.is_admin}
                              >
                                <Shield className="h-4 w-4 ms-2" />
                                تعديل الصلاحيات
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditTarget(p)}>
                                <Pencil className="h-4 w-4 ms-2" />
                                تعديل البيانات
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResetTarget(p)}>
                                <KeyRound className="h-4 w-4 ms-2" />
                                إعادة تعيين كلمة المرور
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(p)}
                                disabled={isMe}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 ms-2" />
                                حذف المستخدم
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />

      <EditPermissionsDialog
        target={permsTarget}
        currentPerms={permsTarget ? permsByUser.get(permsTarget.user_id) ?? new Set() : new Set()}
        onOpenChange={(o) => !o && setPermsTarget(null)}
        onSaved={load}
        currentUserId={currentUser?.id ?? null}
      />

      <EditProfileDialog
        target={editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSaved={load}
      />

      <ResetPasswordDialog
        target={resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
      />

      <DeleteUserDialog
        target={deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onDeleted={load}
      />
    </div>
  );
};

// =====================================================================
// Edit Permissions Dialog — grouped with parent/child gating
// =====================================================================
const EditPermissionsDialog = ({
  target,
  currentPerms,
  onOpenChange,
  onSaved,
  currentUserId,
}: {
  target: Profile | null;
  currentPerms: Set<AppPermission>;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  currentUserId: string | null;
}) => {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Set<AppPermission>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) setPerms(new Set(currentPerms));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const toggleView = (group: PermissionGroup, checked: boolean) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (!group.view) return next;
      if (checked) {
        next.add(group.view);
      } else {
        // Disabling the view also removes all sub-permissions
        next.delete(group.view);
        group.children.forEach((c) => next.delete(c));
      }
      return next;
    });
  };

  const toggleChild = (group: PermissionGroup, perm: AppPermission, checked: boolean) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (checked) {
        // Auto-enable parent view if needed
        if (group.view) next.add(group.view);
        next.add(perm);
      } else {
        next.delete(perm);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!target) return;
    setSaving(true);

    // Diff against currentPerms
    const toAdd: AppPermission[] = [];
    const toRemove: AppPermission[] = [];
    ALL_PERMISSIONS.forEach((p) => {
      const before = currentPerms.has(p);
      const after = perms.has(p);
      if (after && !before) toAdd.push(p);
      if (!after && before) toRemove.push(p);
    });

    try {
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", target.user_id)
          .in("permission", toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((p) => ({
          user_id: target.user_id,
          permission: p,
          granted_by: currentUserId,
        }));
        const { error } = await supabase.from("user_permissions").insert(rows as never);
        if (error) throw error;
      }
      toast({ title: "تم حفظ الصلاحيات" });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: "فشل الحفظ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            صلاحيات: {target?.full_name}
          </DialogTitle>
          <DialogDescription>
            فعّل القسم الرئيسي أولاً ليتم منح أي صلاحية فرعية تحته. إيقاف القسم يلغي كل صلاحياته الفرعية تلقائياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {PERMISSION_GROUPS.map((group) => {
            const viewEnabled = group.view ? perms.has(group.view) : true;
            const childrenEnabled = group.children.filter((c) => perms.has(c)).length;

            return (
              <div
                key={group.key}
                className={cn(
                  "rounded-lg border border-border transition-base",
                  viewEnabled ? "bg-card" : "bg-muted/30",
                )}
              >
                {/* Group header / parent toggle */}
                <div className="flex items-center justify-between gap-3 p-3 border-b border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    {group.view ? (
                      <Checkbox
                        id={`grp-${group.key}`}
                        checked={viewEnabled}
                        onCheckedChange={(v) => toggleView(group, !!v)}
                      />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <label
                      htmlFor={group.view ? `grp-${group.key}` : undefined}
                      className="font-semibold cursor-pointer select-none"
                    >
                      {group.label}
                    </label>
                  </div>
                  <Badge variant="outline" className="text-xs tabular-nums shrink-0">
                    {childrenEnabled + (group.view && viewEnabled ? 1 : 0)} /{" "}
                    {group.children.length + (group.view ? 1 : 0)}
                  </Badge>
                </div>

                {/* Sub-permissions */}
                <ul className="grid gap-1 p-2 sm:grid-cols-2">
                  {group.children.map((perm) => {
                    const checked = perms.has(perm);
                    const disabled = !viewEnabled;
                    return (
                      <li key={perm}>
                        <label
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 transition-base",
                            disabled
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-muted/40 cursor-pointer",
                          )}
                        >
                          <Checkbox
                            checked={checked && !disabled}
                            disabled={disabled}
                            onCheckedChange={(v) => toggleChild(group, perm, !!v)}
                          />
                          <span className="text-sm flex-1">{PERMISSION_LABELS_AR[perm]}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            حفظ الصلاحيات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================================
// Edit Profile Dialog — name & job title
// =====================================================================
const EditProfileDialog = ({
  target,
  onOpenChange,
  onSaved,
}: {
  target: Profile | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.full_name ?? "");
      setJobTitle(target.job_title ?? "");
      setPhone(target.phone ?? "");
    }
  }, [target]);

  const handleSave = async () => {
    if (!target) return;
    if (!name.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        job_title: jobTitle.trim() || null,
        phone: phone.trim() || null,
      } as never)
      .eq("id", target.id);
    setSaving(false);
    if (error) {
      toast({ title: "فشل التحديث", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تحديث البيانات" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">تعديل بيانات المستخدم</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>المسمى الوظيفي</Label>
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="مثال: محاسب" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================================
// Reset Password Dialog
// =====================================================================
const ResetPasswordDialog = ({
  target,
  onOpenChange,
}: {
  target: Profile | null;
  onOpenChange: (v: boolean) => void;
}) => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setPassword("");
      setSuccess(null);
      setShowPassword(false);
    }
  }, [target]);

  const handleSubmit = async () => {
    if (!target) return;
    if (password.length < 6) {
      toast({ title: "كلمة المرور قصيرة", description: "6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { user_id: target.user_id, password },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "فشل إعادة التعيين",
          description: error?.message ?? (data as any)?.error,
          variant: "destructive",
        });
      } else {
        setSuccess(password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!success) return;
    await navigator.clipboard.writeText(success);
    toast({ title: "تم نسخ كلمة المرور" });
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            إعادة تعيين كلمة مرور: {target?.full_name}
          </DialogTitle>
          <DialogDescription>
            ضع كلمة مرور جديدة وأرسلها للمستخدم. الجلسات السابقة ستظل سارية حتى يخرج المستخدم.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-success/30 bg-success/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">تمت إعادة التعيين بنجاح</span>
              </div>
              <div className="font-mono text-sm bg-background rounded-md p-3 border" dir="ltr">
                <span className="text-muted-foreground">New password:</span>{" "}
                <span className="font-semibold">{success}</span>
              </div>
              <Button variant="outline" size="sm" onClick={copyPassword} className="gap-2 w-full">
                <Copy className="h-3.5 w-3.5" /> نسخ كلمة المرور
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>تم</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-2 py-2">
              <Label>كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  dir="ltr"
                  className="text-right pe-10"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                إعادة التعيين
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// =====================================================================
// Delete User Dialog
// =====================================================================
const DeleteUserDialog = ({
  target,
  onOpenChange,
  onDeleted,
}: {
  target: Profile | null;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) => {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: target.user_id },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "فشل حذف المستخدم",
          description: error?.message ?? (data as any)?.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "تم حذف المستخدم" });
      onOpenChange(false);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
          <AlertDialogDescription>
            هل تريد حذف <strong className="text-foreground">{target?.full_name}</strong> نهائياً؟
            سيتم حذف جميع صلاحياته وملفه الشخصي. لا يمكن التراجع.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            تأكيد الحذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// =====================================================================
// Create User Dialog — also uses grouped permissions
// =====================================================================
const CreateUserDialog = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [perms, setPerms] = useState<Set<AppPermission>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ email: string; password: string } | null>(null);

  const reset = () => {
    setEmail(""); setFullName(""); setPassword("");
    setPerms(new Set()); setSuccess(null); setShowPassword(false);
  };

  const toggleView = (group: PermissionGroup, checked: boolean) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (!group.view) return next;
      if (checked) next.add(group.view);
      else {
        next.delete(group.view);
        group.children.forEach((c) => next.delete(c));
      }
      return next;
    });
  };

  const toggleChild = (group: PermissionGroup, perm: AppPermission, checked: boolean) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (group.view) next.add(group.view);
        next.add(perm);
      } else {
        next.delete(perm);
      }
      return next;
    });
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !fullName.trim() || password.length < 6) {
      toast({ title: "بيانات ناقصة", description: "تأكد من الإيميل والاسم وكلمة مرور 6+ أحرف.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          password,
          permissions: Array.from(perms),
        },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "فشل إنشاء المستخدم",
          description: error?.message ?? (data as any)?.error ?? "خطأ غير معروف",
          variant: "destructive",
        });
      } else {
        setSuccess({ email: email.trim().toLowerCase(), password });
        onCreated();
      }
    } catch (e) {
      toast({ title: "فشل الاتصال", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = async () => {
    if (!success) return;
    const text = `بيانات الدخول إلى FinHub:\nالبريد: ${success.email}\nكلمة المرور: ${success.password}`;
    await navigator.clipboard.writeText(text);
    toast({ title: "تم نسخ البيانات" });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {success ? "تم إنشاء المستخدم" : "مستخدم جديد"}
          </DialogTitle>
          <DialogDescription>
            {success
              ? "أرسل البيانات التالية للمستخدم ليتمكن من الدخول."
              : "أدخل بيانات المستخدم وحدد صلاحياته الأولية."}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-success/30 bg-success/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">تم إنشاء الحساب بنجاح</span>
              </div>
              <div className="space-y-2 font-mono text-sm bg-background rounded-md p-3 border" dir="ltr">
                <div><span className="text-muted-foreground">Email:</span> <span className="font-semibold">{success.email}</span></div>
                <div><span className="text-muted-foreground">Password:</span> <span className="font-semibold">{success.password}</span></div>
              </div>
              <Button variant="outline" size="sm" onClick={copyCredentials} className="gap-2 w-full">
                <Copy className="h-3.5 w-3.5" /> نسخ البيانات
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ كلمة المرور لن تظهر مرة أخرى. تأكد من حفظها أو إرسالها للمستخدم الآن.
            </p>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>تم</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>الاسم الكامل</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: أحمد محمد" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input dir="ltr" className="text-right" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <div className="relative">
                  <Input
                    dir="ltr"
                    className="text-right pe-10"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 أحرف على الأقل"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الصلاحيات ({perms.size}/{ALL_PERMISSIONS.length})</Label>
              <div className="space-y-2 rounded-lg border border-border p-2 max-h-72 overflow-y-auto">
                {PERMISSION_GROUPS.map((group) => {
                  const viewEnabled = group.view ? perms.has(group.view) : true;
                  return (
                    <div
                      key={group.key}
                      className={cn(
                        "rounded-md border border-border/60 transition-base",
                        viewEnabled ? "bg-card" : "bg-muted/30",
                      )}
                    >
                      <div className="flex items-center gap-3 p-2 border-b border-border/60">
                        {group.view ? (
                          <Checkbox
                            id={`new-grp-${group.key}`}
                            checked={viewEnabled}
                            onCheckedChange={(v) => toggleView(group, !!v)}
                          />
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                        <label
                          htmlFor={group.view ? `new-grp-${group.key}` : undefined}
                          className="font-semibold text-sm cursor-pointer select-none flex-1"
                        >
                          {group.label}
                        </label>
                      </div>
                      <ul className="grid gap-0.5 p-1 sm:grid-cols-2">
                        {group.children.map((perm) => {
                          const checked = perms.has(perm);
                          const disabled = !viewEnabled;
                          return (
                            <li key={perm}>
                              <label
                                className={cn(
                                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-base",
                                  disabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-muted/40 cursor-pointer",
                                )}
                              >
                                <Checkbox
                                  checked={checked && !disabled}
                                  disabled={disabled}
                                  onCheckedChange={(v) => toggleChild(group, perm, !!v)}
                                />
                                <span className="flex-1">{PERMISSION_LABELS_AR[perm]}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                إنشاء المستخدم
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Users;
