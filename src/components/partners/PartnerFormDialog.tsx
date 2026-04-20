import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { Partner, PartnerType } from "@/lib/finhub-types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner: Partner | null;
  defaultType: PartnerType;
  onSaved: () => void;
}

export const PartnerFormDialog = ({ open, onOpenChange, partner, defaultType, onSaved }: Props) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
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
      setPhone(partner?.phone ?? "");
      setEmail(partner?.email ?? "");
      setAddress(partner?.address ?? "");
      setTaxNumber(partner?.tax_number ?? "");
      setNotes(partner?.notes ?? "");
    }
  }, [open, partner]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name_ar: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      tax_number: taxNumber.trim() || null,
      notes: notes.trim() || null,
    };
    if (code.trim()) payload.code = code.trim();
    if (!partner) payload.partner_type = defaultType;

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
          <DialogTitle className="font-display">{partner ? "تعديل البيانات" : "إضافة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الكود {partner ? "" : "(اختياري)"}</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="يُنشأ تلقائياً" />
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
