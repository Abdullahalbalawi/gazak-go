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
        // Supabase returns authentication errors in the URL hash when the
        // confirmation link cannot be consumed.
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const authError = hashParams.get("error_description") || hashParams.get("error");
        if (authError) {
          throw new Error(decodeURIComponent(authError.replace(/\+/g, " ")));
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (data.session?.user) {
          navigate("/", { replace: true });
          return;
        }

        // Give detectSessionInUrl a moment to finish processing the
        // confirmation callback before declaring the link invalid.
        const session = await new Promise((resolve) => {
          let settled = false;
          const finishOnce = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            subscription.unsubscribe();
            resolve(value);
          };

          const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (nextSession?.user) finishOnce(nextSession);
          });
          const subscription = listener.subscription;
          const timer = setTimeout(async () => {
            const { data: latest } = await supabase.auth.getSession();
            finishOnce(latest.session || null);
          }, 1500);
        });

        if (!session?.user) {
          throw new Error("تعذر تأكيد البريد الإلكتروني. قد يكون الرابط منتهي الصلاحية أو تم استخدامه مسبقًا.");
        }

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
    <AuthLayout
      icon={error ? AlertTriangle : MailCheck}
      title={error ? "تعذر تأكيد البريد" : "تم تأكيد البريد"}
      subtitle={error || "تم تأكيد بريدك الإلكتروني بنجاح."}
    >
      {error && <p className="text-sm text-center text-destructive">{error}</p>}
    </AuthLayout>
  );
}
