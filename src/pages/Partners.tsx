import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Users, Pencil } from "lucide-react";
import { PARTNER_TYPE_LABELS_AR, type Partner, type PartnerType } from "@/lib/finhub-types";

const Partners = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [filter, setFilter] = useState<PartnerType | "all">("all");

  const canCreate = hasPermission("partners.create");
  const canEdit = hasPermission("partners.edit");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("partners").select("*").order("code");
    if (error) {
      toast({ title: "فشل التحميل", description: error.message, variant: "destructive" });
    }
    setPartners((data ?? []) as Partner[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = partners.filter((p) => filter === "all" || p.partner_type === filter || p.partner_type === "both");

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Partner) => { setEditing(p); setDialogOpen(true); };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> العملاء والموردين
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة الأطراف الخارجية المرتبطة بالقيود.</p>
        </div>
        {canCreate && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> طرف جديد</Button>}
      </header>

      <div className="flex gap-2">
        {(["all", "customer", "supplier", "both"] as const).map((t) => (
          <Button key={t} variant={filter === t ? "default" : "outline"} size="sm" onClick={() => setFilter(t)}>
            {t === "all" ? "الكل" : PARTNER_TYPE_LABELS_AR[t]}
          </Button>
        ))}
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">لا توجد بيانات.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الكود</th>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right font-medium">النوع</th>
                    <th className="px-4 py-3 text-right font-medium">الهاتف</th>
                    <th className="px-4 py-3 text-right font-medium">البريد</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-base">
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">{p.code}</td>
                      <td className="px-4 py-3 font-medium">{p.name_ar}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{PARTNER_TYPE_LABELS_AR[p.partner_type]}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">{p.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">{p.email ?? "—"}</td>
                      <td className="px-4 py-3 text-end">
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PartnerDialog open={dialogOpen} onOpenChange={setDialogOpen} partner={editing} onSaved={load} />
    </div>
  );
};

const PartnerDialog = ({
  open, onOpenChange, partner, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; partner: Partner | null; onSaved: () => void }) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<PartnerType>("customer");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(partner?.code ?? "");
      setName(partner?.name_ar ?? "");
      setType(partner?.partner_type ?? "customer");
      setPhone(partner?.phone ?? "");
      setEmail(partner?.email ?? "");
      setAddress(partner?.address ?? "");
      setTaxNumber(partner?.tax_number ?? "");
      setNotes(partner?.notes ?? "");
    }
  }, [open, partner]);

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      toast({ title: "الكود والاسم مطلوبان", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      code: code.trim(),
      name_ar: name.trim(),
      partner_type: type,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      tax_number: taxNumber.trim() || null,
      notes: notes.trim() || null,
    };
    const { error } = partner
      ? await supabase.from("partners").update(payload).eq("id", partner.id)
      : await supabase.from("partners").insert(payload as never);
    setSaving(false);
    if (error) {
      toast({ title: "فشل الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: partner ? "تم التعديل" : "تم الإنشاء" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{partner ? "تعديل بيانات الطرف" : "طرف جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الكود</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="C-001" />
          </div>
          <div className="space-y-2">
            <Label>النوع</Label>
            <Select value={type} onValueChange={(v) => setType(v as PartnerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(PARTNER_TYPE_LABELS_AR) as [PartnerType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الهاتف</Label>
            <Input dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input dir="ltr" className="text-right" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>العنوان</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>الرقم الضريبي</Label>
            <Input dir="ltr" className="text-right" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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

export default Partners;
