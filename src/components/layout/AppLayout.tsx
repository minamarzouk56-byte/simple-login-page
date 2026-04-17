import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Wallet,
  LayoutDashboard,
  Network,
  BookOpen,
  Users,
  BarChart3,
  Shield,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import type { AppPermission } from "@/lib/finhub-types";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: AppPermission;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/accounts", label: "شجرة الحسابات", icon: Network, permission: "accounts.view" },
  { to: "/journal", label: "القيود اليومية", icon: BookOpen, permission: "journal.view" },
  { to: "/partners", label: "العملاء والموردين", icon: Users, permission: "partners.view" },
  { to: "/reports", label: "التقارير المالية", icon: BarChart3, permission: "reports.view" },
  { to: "/users", label: "المستخدمون والصلاحيات", icon: Shield, permission: "users.manage" },
];

export const AppLayout = () => {
  const { profile, signOut, hasPermission } = useAuth();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter((i) => !i.permission || hasPermission(i.permission));

  const currentTitle =
    NAV_ITEMS.find((i) => i.to === location.pathname)?.label ?? "FinHub";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-l border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-soft">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-none text-sidebar-foreground">FinHub</h1>
            <p className="mt-1 text-xs text-sidebar-foreground/60">نظام المحاسبة</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-base",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )
                  }
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronLeft className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {(profile?.full_name ?? "?").charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name ?? "مستخدم"}
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                {profile?.is_admin ? "مسؤول" : "مستخدم"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-sidebar-foreground/80">
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 md:px-8 backdrop-blur">
          <h2 className="font-display text-lg font-semibold text-foreground">{currentTitle}</h2>
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
