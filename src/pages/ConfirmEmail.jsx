import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, MailCheck, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const finish = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session?.user) {
          throw new Error("تعذر تأكيد البريد الإلكتروني. قد يكون الرابط منتهي الصلاحية أو تم استخدامه مسبقًا.");
        }

        // AuthContext will load the user's profile after the session is established.
        navigate("/", { replace: true });
      } catch (err) {
        if (mounted) setError(err.message || "تعذر تأكيد البريد الإلكتروني");
      } finally {
        if (mounted) setChecking(false);
      }
    };

    finish();
    return () => { mounted = false; };
  }, [navigate]);

  if (checking) {
    return (
      <AuthLayout icon={MailCheck} title="جاري تأكيد البريد" subtitle="لحظات من فضلك...">
        <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={error ? AlertTriangle : MailCheck} title={error ? "تعذر تأكيد البريد" : "تم تأكيد البريد"} subtitle={error || "تم تأكيد بريدك الإلكتروني بنجاح."}>
      {error && <p className="text-sm text-center text-destructive">{error}</p>}
    </AuthLayout>
  );
}
