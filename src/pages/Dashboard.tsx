import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Network, BookOpen, Users, Wallet } from "lucide-react";

interface Stats {
  accounts: number;
  entries: number;
  customers: number;
  suppliers: number;
}

const Dashboard = () => {
  const { profile, hasPermission } = useAuth();
  const [stats, setStats] = useState<Stats>({ accounts: 0, entries: 0, customers: 0, suppliers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const queries = await Promise.all([
        hasPermission("accounts.view")
          ? supabase.from("accounts").select("id", { count: "exact", head: true })
          : Promise.resolve({ count: 0 }),
        hasPermission("journal.view")
          ? supabase.from("journal_entries").select("id", { count: "exact", head: true })
          : Promise.resolve({ count: 0 }),
        hasPermission("customers.view")
          ? supabase.from("customers").select("id", { count: "exact", head: true })
          : Promise.resolve({ count: 0 }),
        hasPermission("suppliers.view")
          ? supabase.from("suppliers").select("id", { count: "exact", head: true })
          : Promise.resolve({ count: 0 }),
      ]);
      setStats({
        accounts: queries[0].count ?? 0,
        entries: queries[1].count ?? 0,
        customers: queries[2].count ?? 0,
        suppliers: queries[3].count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, [hasPermission]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <section>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          أهلاً، {profile?.full_name ?? "مستخدم"} 👋
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          نظرة سريعة على نشاط النظام المحاسبي.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Network} label="حسابات" value={stats.accounts} loading={loading} accent="primary" />
        <StatCard icon={BookOpen} label="قيود يومية" value={stats.entries} loading={loading} accent="accent" />
        <StatCard icon={Users} label="العملاء" value={stats.customers} loading={loading} accent="success" />
        <StatCard icon={Users} label="الموردين" value={stats.suppliers} loading={loading} accent="success" />
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            ابدأ من هنا
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• أنشئ شجرة حسابات شركتك من قسم <strong className="text-foreground">شجرة الحسابات</strong>.</p>
          <p>• سجّل العملاء والموردين قبل البدء في القيود.</p>
          <p>• كل قيد يومية يجب أن يكون متوازناً (مدين = دائن).</p>
          {profile?.is_admin && (
            <p>• بصفتك مسؤولاً، يمكنك منح الصلاحيات للمستخدمين من قسم <strong className="text-foreground">المستخدمون والصلاحيات</strong>.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  loading: boolean;
  accent: "primary" | "accent" | "success";
}) => {
  const accentClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/10 text-success",
  }[accent];

  return (
    <Card className="shadow-soft transition-base hover:shadow-elegant hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">
              {loading ? "—" : value.toLocaleString("ar-EG")}
            </p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClasses}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
