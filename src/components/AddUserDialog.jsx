import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ROLES = [
  { value: "customer", label: "عميل" },
  { value: "distributor", label: "موزع" },
  { value: "driver", label: "سائق" },
  { value: "admin", label: "إدارة" },
];

export default function AddUserDialog({ open, onOpenChange, onDone }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("customer");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: "أدخل البريد الإلكتروني", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // inviteUser only accepts platform roles "user" or "admin"
      const platformRole = role === "admin" ? "admin" : "user";
      await base44.users.inviteUser(email.trim(), platformRole, role);
      toast({
        title: "تم إرسال الدعوة بنجاح",
        description:
          role === "admin"
            ? "تمت دعوة المستخدم كمسؤول."
            : "سيظهر المستخدم بقاعدة (عميل) بعد تسجيله — غيّر دوره بعدها من قائمة المستخدمين.",
      });
      setEmail("");
      setRole("customer");
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast({
        title: "فشل إرسال الدعوة",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            إضافة مستخدم
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            سيتم إرسال دعوة بالبريد الإلكتروني للمستخدم لإكمال التسجيل. للأدوار غير الإدارية، يبدأ المستخدم كعميل بعد تسجيله ويمكن تغيير دوره لاحقًا.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال الدعوة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}