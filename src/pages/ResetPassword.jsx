import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { waitForAuthSession } from "@/lib/authCallback";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const prepareRecovery = async () => {
      try {
        const session = await waitForAuthSession(supabase);

        if (mounted) {
          setReady(Boolean(session?.user));
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "رابط إعادة التعيين غير صالح أو منتهي الصلاحية");
          setReady(false);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    prepareRecovery();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "فشل تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthLayout
        icon={Lock}
        title="جاري التحقق"
        subtitle="نجهز رابط إعادة تعيين كلمة المرور..."
      >
        <div className="flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (!ready) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="رابط غير صالح"
        subtitle="رابط إعادة تعيين كلمة المرور مفقود أو منتهي الصلاحية"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            طلب رابط جديد
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          {error || "يرجى طلب رابط جديد لإعادة تعيين كلمة المرور."}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="كلمة المرور الجديدة"
      subtitle="أدخل كلمة المرور الجديدة أدناه"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور الجديدة</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10 h-12"
              required
              minLength={6}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10 h-12"
              required
              minLength={6}
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              جاري تحديث كلمة المرور...
            </>
          ) : (
            "تحديث كلمة المرور"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
