import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppPermission, Profile } from "@/lib/finhub-types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  permissions: Set<AppPermission>;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPermission: (p: AppPermission) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<AppPermission>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (uid: string) => {
    const [{ data: prof }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_permissions").select("permission").eq("user_id", uid),
    ]);
    setProfile((prof as Profile) ?? null);
    setPermissions(new Set((perms ?? []).map((r: { permission: AppPermission }) => r.permission)));
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (user?.id) await loadUserData(user.id);
  }, [user?.id, loadUserData]);

  useEffect(() => {
    // Listener FIRST, then session check (avoids race conditions)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlock inside auth callback
        setTimeout(() => loadUserData(newSession.user.id), 0);
      } else {
        setProfile(null);
        setPermissions(new Set());
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadUserData(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasPermission = (p: AppPermission) => {
    if (profile?.is_admin) return true;
    return permissions.has(p);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, permissions, loading, signIn, signUp, signOut, hasPermission, refreshPermissions }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
