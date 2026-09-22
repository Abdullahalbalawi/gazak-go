import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const prepare = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let session = data.session;

        if (!session?.user) {
          session = await new Promise((resolve) => {
            let settled = false;
            let subscription = null;
            let timer = null;

            const finishOnce = (value) => {
              if (settled) return;
              settled = true;
              if (timer) clearTimeout(timer);
              subscription?.unsubscribe();
              resolve(value);
            };

            const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
              if (nextSession?.user) finishOnce(nextSession);
            });
            subscription = listener.subscription;

            timer = setTimeout(async () => {
              const { data: latest } = await supabase.auth.getSession();
              finishOnce(latest.session || null);
            }, 1500);
          });
        }

        if (!session?.user) throw new Error("رابط الدعوة غير صالح أو منتهي الصلاحية");
        if (mounted) setReady(true);
      } catch (err) {
        if (mounted) setError(err.message || "رابط الدعوة غير صالح أو منتهي الصلاحية");
      } finally {
        if (mounted) setChecking(false);
      }
    };
    prepare();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل");
    if (password !== confirmPassword) return setError("كلمتا المرور غير متطابقتين");

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "تعذر إكمال إنشاء الحساب");
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return <AuthLayout icon={Lock} title="جاري التحقق" subtitle="جاري تجهيز دعوتك..."><div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div></AuthLayout>;
  }

  if (!ready) {
    return (
      <AuthLayout icon={AlertTriangle} title="رابط الدعوة غير صالح" subtitle="قد يكون الرابط منتهي الصلاحية أو تم استخدامه مسبقًا">
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button className="w-full h-12 mt-4" onClick={() => navigate("/login", { replace: true })}>العودة لتسجيل الدخول</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="إكمال الدعوة" subtitle="أنشئ كلمة المرور لإكمال حسابك">
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="invite-password">كلمة المرور</Label><Input id="invite-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className="h-12" /></div>
        <div className="space-y-2"><Label htmlFor="invite-confirm">تأكيد كلمة المرور</Label><Input id="invite-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required className="h-12" /></div>
        <Button type="submit" className="w-full h-12" disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الحفظ...</> : "إكمال إنشاء الحساب"}</Button>
      </form>
    </AuthLayout>
  );
}
