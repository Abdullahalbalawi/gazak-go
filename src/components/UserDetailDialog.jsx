import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
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
import { Loader2, Trash2, Power, PowerOff, Save, Mail, Phone, Shield } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ROLES = [
  { value: "customer", label: "عميل" },
  { value: "distributor", label: "موزع" },
  { value: "driver", label: "سائق" },
  { value: "admin", label: "إدارة" },
];

const ROLE_BADGE = {
  customer: "bg-blue-100 text-blue-700",
  distributor: "bg-purple-100 text-purple-700",
  driver: "bg-orange-100 text-orange-700",
  admin: "bg-green-100 text-green-700",
};

export default function UserDetailDialog({ user, open, onOpenChange, onDone }) {
  const [editMode, setEditMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("customer");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (user) {
      setEditMode(false);
      setPhone(user.phone || "");
      setRole(user.role || "customer");
    }
  }, [user, open]);

  if (!user) return null;

  const active = user.active !== false;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await supabaseApi.entities.User.update(user.id, {
        phone: phone.trim(),
        role,
      });
      toast({ title: "تم حفظ التعديلات" });
      onDone?.(updated);
      setEditMode(false);
    } catch (e) {
      toast({
        title: "فشل الحفظ",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`سيتم حذف حساب المستخدم "${user.full_name || user.email}" نهائيًا ولن يتمكن من تسجيل الدخول. هل تريد المتابعة؟`)) return;
    setDeleting(true);
    try {
      await supabaseApi.entities.User.delete(user.id);
      toast({ title: "تم حذف المستخدم" });
      onOpenChange(false);
      onDone?.(null, user.id);
    } catch (e) {
      toast({
        title: "فشل الحذف",
        description:
          e.message === "USER_HAS_RELATED_DATA"
            ? "لا يمكن حذف المستخدم لأن لديه طلبات أو حركات محفوظة. يمكنك إلغاء تنشيطه بدلًا من ذلك."
            : e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      const updated = await supabaseApi.entities.User.update(user.id, { active: !active });
      toast({ title: active ? "تم إلغاء التنشيط" : "تم التنشيط" });
      onDone?.(updated);
    } catch (e) {
      toast({
        title: "فشل التغيير",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  };

  const badge = ROLE_BADGE[user.role || "customer"] || "bg-gray-100 text-gray-700";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>بيانات المستخدم</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge}`}>
              {ROLES.find((r) => r.value === (user.role || "customer"))?.label}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {active ? "نشط" : "متوقف"}
            </span>
          </div>

          {editMode ? (
            <>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
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
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground break-all">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{user.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{user.full_name || "بدون اسم"}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {editMode ? (
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)} disabled={saving}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setEditMode(true)}>
                  تعديل
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleToggleActive}
                  disabled={toggling}
                >
                  {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  {active ? "إلغاء التنشيط" : "تنشيط"}
                </Button>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف المستخدم
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
