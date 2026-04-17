import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ChevronLeft } from "lucide-react";
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
    if (selectedUser?.id === userId) {
      setSelectedUser(profiles.find((p) => p.id === userId) ?? selectedUser);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> المستخدمون والصلاحيات
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">امنح أو اسحب الصلاحيات لكل مستخدم على حدة.</p>
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
    </div>
  );
};

export default Users;
