import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabaseApi } from "@/lib/supabaseApi";
import CustomerHeader from "@/components/CustomerHeader";
import BottomNav from "@/components/BottomNav";
import StatusBadge from "@/components/StatusBadge";
import OrderHistoryTimeline from "@/components/OrderHistoryTimeline";
import { ORDER_STATUSES, STATUS_LABELS_AR, canCancel } from "@/lib/orderStatus";
import { ArrowLeft, Loader2, MapPin, X, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function TrackOrder() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = async () => {
    try {
      const o = await supabaseApi.entities.Order.get(id);
      setOrder(o);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: order.id,
        action: "cancel",
      });
      setOrder(res.data.order);
      toast({ title: "تم إلغاء الطلب" });
    } catch (e) {
      toast({ title: "فشل الإلغاء", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center text-muted-foreground">
          لم يتم العثور على الطلب
          <div className="mt-4">
            <Link to="/my-orders" className="text-primary font-medium hover:underline">العودة لطلباتي</Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const currentIdx = ORDER_STATUSES.indexOf(order.status);
  const mapsLink = order.latitude && order.longitude
    ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <CustomerHeader />
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/my-orders" className="p-1 -mr-1">
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Link>
          <h2 className="font-bold text-lg text-foreground">متابعة الطلب</h2>
        </div>

        {/* ملخص الطلب */}
        <div className="bg-white rounded-2xl border border-border p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">{new Date(order.created_date).toLocaleString("ar-SA")}</p>
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
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-bold">الإجمالي</span>
            <span className="font-bold text-primary">{order.total} ر.س</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">طريقة الدفع</span>
            <span>{order.payment_method === "CASH" ? "نقداً" : "بطاقة"}</span>
          </div>
          {order.address && (
            <div className="mt-2 flex items-start gap-1 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">{order.address}</span>
            </div>
          )}
        </div>

        {/* خط زمني للحالة */}
        {order.status !== "CANCELLED" && (
          <div className="bg-white rounded-2xl border border-border p-4 mb-4">
            <h3 className="font-semibold text-sm text-foreground mb-4">مراحل الطلب</h3>
            <div className="space-y-3">
              {ORDER_STATUSES.filter((s) => s !== "CANCELLED").map((status, idx) => {
                const statusIdx = ORDER_STATUSES.indexOf(status);
                const done = currentIdx >= statusIdx && currentIdx !== -1;
                const isCurrent = order.status === status;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                    }`}>
                      {done ? <Check className="w-4 h-4" /> : <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <span className={`text-sm ${isCurrent ? "font-bold text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                      {STATUS_LABELS_AR[status]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <OrderHistoryTimeline orderId={order.id} />

        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-border bg-white text-sm font-medium hover:bg-muted mb-3"
          >
            <MapPin className="w-4 h-4" />
            فتح الموقع في الخرائط
          </a>
        )}

        {canCancel(order.status, "customer") && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            إلغاء الطلب
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  );
}