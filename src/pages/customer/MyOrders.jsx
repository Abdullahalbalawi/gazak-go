import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import CustomerHeader from "@/components/CustomerHeader";
import BottomNav from "@/components/BottomNav";
import StatusBadge from "@/components/StatusBadge";
import { canCancel } from "@/lib/orderStatus";
import { ClipboardList, Loader2, ChevronLeft, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  const fetchOrders = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      setOrders((data || []).map((order) => ({
        ...order,
        created_date: order.created_at,
        items: (order.order_items || []).map((item) => ({
          ...item,
          total: Number(item.price || 0) * Number(item.quantity || 0),
        })),
      })));
    } catch (e) {
      console.error(e);
      toast({ title: "تعذر تحميل الطلبات", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user?.id]);

  const handleCancel = async (orderId) => {
    setCancelling(orderId);
    try {
      const { data, error } = await supabase.rpc("transition_order", {
        p_order_id: orderId,
        p_new_status: "CANCELLED",
        p_note: "Cancelled by customer",
      });
      if (error) throw error;

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...data, status: "CANCELLED" } : o)));
      toast({ title: "تم إلغاء الطلب" });
    } catch (e) {
      toast({ title: "فشل الإلغاء", description: e.message, variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <CustomerHeader />
      <div className="max-w-md mx-auto px-4 py-4">
        <h2 className="font-bold text-lg text-foreground mb-4">طلباتي</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <ClipboardList className="w-14 h-14 mb-3" />
            <p className="font-medium">لا توجد طلبات بعد</p>
            <Link to="/" className="mt-4 text-primary font-medium text-sm hover:underline">
              ابدأ طلبك الآن
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("ar-SA")}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="space-y-1 mb-3">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.product_name} × {item.quantity}</span>
                      <span className="text-muted-foreground">{item.total} ر.س</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="font-bold text-primary">{order.total} ر.س</span>
                  <div className="flex gap-2">
                    {canCancel(order.status, "customer") && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancelling === order.id}
                        className="inline-flex items-center gap-1 px-3 h-9 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancelling === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        إلغاء
                      </button>
                    )}
                    <Link
                      to={`/track-order/${order.id}`}
                      className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                    >
                      متابعة
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}