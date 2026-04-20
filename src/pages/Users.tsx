import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Shield, ChevronLeft, Plus, Copy, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { PERMISSION_LABELS_AR, type AppPermission, type Profile, type UserPermission } from "@/lib/finhub-types";

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS_AR) as AppPermission[];

const Users = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permsByUser, setPermsByUser] = useState<Map<string, Set<AppPermission>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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

  const togglePerm = async (userId: string, perm: AppPermission, checked: boolean) => {
    setSaving(true);
    if (checked) {
      const { error } = await supabase.from("user_permissions").insert({
        user_id: userId,
        permission: perm,
        granted_by: currentUser?.id ?? null,
      } as never);
      if (error) toast({ title: "فشل المنح", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission", perm);
      if (error) toast({ title: "فشل الإزالة", description: error.message, variant: "destructive" });
    }
    setSaving(false);
    await load();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> المستخدمون والصلاحيات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">أنشئ المستخدمين وامنحهم الصلاحيات المناسبة.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> مستخدم جديد
        </Button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="shadow-soft h-fit">
            <CardContent className="p-2">
              <ul className="space-y-1">
                {profiles.map((p) => {
                  const isSelected = selectedUser?.id === p.id;
                  const permCount = permsByUser.get(p.id)?.size ?? 0;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(p)}
                        className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-right transition-base ${
                          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                          {(p.full_name ?? "?").charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{p.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.is_admin ? "مسؤول" : `${permCount} صلاحية`}
                          </p>
                        </div>
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              {!selectedUser ? (
                <div className="py-16 text-center text-muted-foreground">
                  اختر مستخدماً من القائمة لإدارة صلاحياته.
                </div>
              ) : selectedUser.is_admin ? (
                <div className="py-12 text-center space-y-3">
                  <Badge className="bg-primary/10 text-primary">مسؤول النظام</Badge>
                  <h3 className="font-display text-lg font-bold">{selectedUser.full_name}</h3>
                  <p className="text-sm text-muted-foreground">المسؤولون لديهم كل الصلاحيات تلقائياً.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="font-display text-lg font-bold">{selectedUser.full_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {permsByUser.get(selectedUser.id)?.size ?? 0} من {ALL_PERMISSIONS.length} صلاحية
                      </p>
                    </div>
                    {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {ALL_PERMISSIONS.map((perm) => {
                      const checked = permsByUser.get(selectedUser.id)?.has(perm) ?? false;
                      return (
                        <li key={perm}>
                          <label className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-base">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => togglePerm(selectedUser.id, perm, !!v)}
                              disabled={saving}
                            />
                            <span className="text-sm flex-1">{PERMISSION_LABELS_AR[perm]}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
    </div>
  );
};



const CreateUserDialog = ({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) => {
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

  const togglePerm = (p: AppPermission) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
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
        toast({ title: "فشل إنشاء المستخدم", description: error?.message ?? (data as any)?.error ?? "خطأ غير معروف", variant: "destructive" });
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
              : "أدخل بيانات المستخدم وحدد الصلاحيات المسموح بها."}
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
              <div className="flex items-center justify-between">
                <Label>الصلاحيات ({perms.size}/{ALL_PERMISSIONS.length})</Label>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => setPerms(perms.size === ALL_PERMISSIONS.length ? new Set() : new Set(ALL_PERMISSIONS))}
                >
                  {perms.size === ALL_PERMISSIONS.length ? "إلغاء الكل" : "تحديد الكل"}
                </Button>
              </div>
              <ul className="grid gap-1 sm:grid-cols-2 rounded-lg border border-border p-2 max-h-64 overflow-y-auto">
                {ALL_PERMISSIONS.map((perm) => (
                  <li key={perm}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer text-sm">
                      <Checkbox checked={perms.has(perm)} onCheckedChange={() => togglePerm(perm)} />
                      <span className="flex-1">{PERMISSION_LABELS_AR[perm]}</span>
                    </label>
                  </li>
                ))}
              </ul>
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
