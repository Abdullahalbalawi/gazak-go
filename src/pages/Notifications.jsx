import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Bell, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const list = await base44.entities.Notification.filter(
        { user_id: user.id },
        "-created_date",
        50
      );
      setNotifications(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      await base44.functions.invoke("markNotificationRead", { all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: "تم تحديد الكل كمقروء" });
    } catch (e) {
      toast({ title: "فشل التحديث", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={user?.role === "customer" ? "/" : user?.role === "distributor" ? "/distributor" : user?.role === "driver" ? "/driver" : "/admin"} className="text-sm text-muted-foreground hover:text-foreground">
            رجوع
          </Link>
          <h1 className="font-bold text-base">الإشعارات</h1>
          <button onClick={markAllRead} className="text-sm text-primary font-medium">
            تعليم الكل كمقروء
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Bell className="w-14 h-14 mb-3" />
            <p className="font-medium">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  n.read ? "bg-white border-border" : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  n.read ? "bg-gray-100" : "bg-primary text-primary-foreground"
                }`}>
                  {n.read ? <Check className="w-4 h-4 text-muted-foreground" /> : <Bell className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_date).toLocaleString("ar-SA")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}