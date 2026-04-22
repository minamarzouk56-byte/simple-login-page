import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Topbar } from "./Topbar";
import {
  Wallet,
  LayoutDashboard,
  Network,
  BookOpen,
  Users,
  Truck,
  BarChart3,
  Shield,
  ChevronLeft,
  ChevronDown,
  Package,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  ReceiptText,
  Receipt,
} from "lucide-react";
import type { AppPermission } from "@/lib/finhub-types";

interface NavLeaf {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: AppPermission;
  /** if any of these match, the leaf is visible */
  anyPermission?: AppPermission[];
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** group is visible if user has ANY of these */
  anyPermission?: AppPermission[];
  children: NavLeaf[];
  /** path prefix used to auto-expand on active */
  prefix: string;
}

type NavNode = NavLeaf | NavGroup;

const isGroup = (n: NavNode): n is NavGroup => "children" in n;

const NAV_ITEMS: NavNode[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, permission: "dashboard.view" },
  { to: "/accounts", label: "شجرة الحسابات", icon: Network, permission: "accounts.view" },
  { to: "/journal", label: "القيود اليومية", icon: BookOpen, permission: "journal.view" },
  { to: "/customers", label: "العملاء", icon: Users, permission: "customers.view" },
  { to: "/suppliers", label: "الموردين", icon: Truck, permission: "suppliers.view" },
  { to: "/products", label: "المنتجات", icon: Package, permission: "inventory.view" },
  {
    label: "المخزون",
    icon: Boxes,
    prefix: "/inventory",
    anyPermission: ["inventory.view", "inventory.manage", "inventory.request", "inventory.approve"],
    children: [
      { to: "/inventory", label: "إدارة المخزون", icon: Boxes, anyPermission: ["inventory.view", "inventory.manage"] },
      { to: "/inventory/movements", label: "حركات المخزن", icon: ArrowLeftRight, permission: "inventory.view" },
    ],
  },
  {
    label: "الطلبات والفواتير",
    icon: Receipt,
    prefix: "/orders",
    anyPermission: ["invoices.view", "invoices.manage", "invoices.approve"],
    children: [
      { to: "/orders/purchases", label: "طلبات الشراء", icon: ShoppingCart, anyPermission: ["invoices.view", "invoices.manage", "invoices.approve"] },
      { to: "/orders/sales", label: "طلبات البيع", icon: ReceiptText, anyPermission: ["invoices.view", "invoices.manage", "invoices.approve"] },
    ],
  },
  { to: "/reports", label: "التقارير المالية", icon: BarChart3, permission: "reports.view" },
  { to: "/users", label: "المستخدمون والصلاحيات", icon: Shield, permission: "users.manage" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "لوحة التحكم",
  "/accounts": "شجرة الحسابات",
  "/journal": "القيود اليومية",
  "/customers": "العملاء",
  "/suppliers": "الموردين",
  "/products": "المنتجات",
  "/inventory": "إدارة المخزون",
  "/inventory/movements": "حركات المخزن",
  "/orders/purchases": "طلبات الشراء",
  "/orders/sales": "طلبات البيع",
  "/reports": "التقارير المالية",
  "/users": "المستخدمون والصلاحيات",
};

export const AppLayout = () => {
  const { hasPermission } = useAuth();
  const location = useLocation();

  const canSee = (leaf: NavLeaf) => {
    if (leaf.permission && !hasPermission(leaf.permission)) return false;
    if (leaf.anyPermission && !leaf.anyPermission.some((p) => hasPermission(p))) return false;
    return true;
  };

  const visibleNodes: NavNode[] = NAV_ITEMS.flatMap<NavNode>((node) => {
    if (isGroup(node)) {
      const children = node.children.filter(canSee);
      if (children.length === 0) return [];
      if (node.anyPermission && !node.anyPermission.some((p) => hasPermission(p))) return [];
      return [{ ...node, children }];
    }
    return canSee(node) ? [node] : [];
  });

  // Auto-open the group containing the active route
  const initialOpen: Record<string, boolean> = {};
  visibleNodes.forEach((n) => {
    if (isGroup(n) && location.pathname.startsWith(n.prefix)) initialOpen[n.label] = true;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpen);

  const currentTitle = PAGE_TITLES[location.pathname] ?? "FinHub";

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
            {visibleNodes.map((node) => {
              if (isGroup(node)) {
                const open = openGroups[node.label] ?? location.pathname.startsWith(node.prefix);
                const activeChild = node.children.some((c) => location.pathname === c.to);
                return (
                  <li key={node.label}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((prev) => ({ ...prev, [node.label]: !open }))
                      }
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-base",
                        activeChild
                          ? "bg-sidebar-accent/40 text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <node.icon className="h-4.5 w-4.5 shrink-0" />
                      <span className="flex-1 text-start">{node.label}</span>
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform opacity-60", open && "rotate-180")}
                      />
                    </button>
                    {open && (
                      <ul className="mt-1 mr-4 space-y-1 border-r border-sidebar-border/60 pr-2">
                        {node.children.map((child) => (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              className={({ isActive }) =>
                                cn(
                                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-base",
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm font-medium"
                                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                                )
                              }
                            >
                              <child.icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1">{child.label}</span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              const leaf = node;
              return (
                <li key={leaf.to}>
                  <NavLink
                    to={leaf.to}
                    end={leaf.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-base",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )
                    }
                  >
                    <leaf.icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="flex-1">{leaf.label}</span>
                    <ChevronLeft className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={currentTitle} />
        <main className="flex-1 p-4 md:p-8 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
