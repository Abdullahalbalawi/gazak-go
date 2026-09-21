import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabaseApi } from "@/lib/supabaseApi";
import { useAuth } from "@/lib/AuthContext";
import StaffHeader from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import OrderHistoryTimeline from "@/components/OrderHistoryTimeline";
import { canTransition } from "@/lib/orderStatus";
import { ArrowLeft, Loader2, MapPin, Phone, CheckCircle2, PackageCheck, Truck, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

export default function DistributorOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

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

  const doTransition = async (action, extra = {}) => {
    const t = canTransition(action, order.status, user.role);
    if (!t) return;
    setActing(action);
    try {
      const res = await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: order.id,
        action,
        extra,
      });
      setOrder(res.data.order);
      toast({ title: "تم تحديث الحالة" });
    } catch (e) {
      toast({ title: "فشل التحديث", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActing(null);
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
      <div className="min-h-screen bg-gray-50">
        <StaffHeader title="تفاصيل الطلب" />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
          لم يتم العثور على الطلب
        </div>
      </div>
    );
  }

  const mapsLink = order.latitude && order.longitude
    ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <StaffHeader title="تفاصيل الطلب" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        <button onClick={() => navigate("/distributor")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4 rotate-180" />
          العودة للطلبات
        </button>

        {/* معلومات الطلب */}
        <div className="bg-white rounded-2xl border border-border p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-muted-foreground mb-3">{new Date(order.created_date).toLocaleString("ar-SA")}</p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{order.customer_name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <a href={`tel:${order.customer_phone}`} className="hover:text-primary">{order.customer_phone}</a>
            </div>
            {order.address && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{order.address}</span>
              </div>
            )}
            {mapsLink && (
              <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline">
                <MapPin className="w-4 h-4" />
                فتح الموقع في الخرائط
              </a>
            )}
          </div>
        </div>

        {/* المنتجات */}
        <div className="bg-white rounded-2xl border border-border p-4 mb-3">
          <h3 className="font-semibold text-sm text-foreground mb-3">المنتجات</h3>
          <div className="space-y-2">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.product_name} × {item.quantity}</span>
                <span className="text-muted-foreground">{item.total} ر.س</span>
              </div>
            ))}
          </div>
          {order.return_count > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
              <RotateCcw className="w-4 h-4" />
              استلام {order.return_count} أسطوانة فارغة من العميل عند التوصيل
            </div>
          )}
          <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإجمالي الفرعي</span>
              <span>{order.subtotal} ر.س</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم التوصيل</span>
              <span>{order.delivery_fee} ر.س</span>
            </div>
            <div className="flex justify-between font-bold pt-1">
              <span>الإجمالي</span>
              <span className="text-primary">{order.total} ر.س</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">طريقة الدفع</span>
              <span>{order.payment_method === "CASH" ? "نقداً" : "بطاقة"}</span>
            </div>
          </div>
        </div>

        <OrderHistoryTimeline orderId={order.id} />

        {/* الأزرار التسلسلية */}
        <div className="space-y-2">
          {canTransition("accept", order.status, user.role) && (
            <Button
              onClick={() => doTransition("accept", { distributor_id: user.id })}
              disabled={acting !== null}
              className="w-full h-14 text-base font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              {acting === "accept" ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 ml-2" />}
              قبول الطلب
            </Button>
          )}
          {canTransition("prepare", order.status, user.role) && (
            <Button
              onClick={() => doTransition("prepare")}
              disabled={acting !== null}
              className="w-full h-14 text-base font-bold rounded-2xl bg-amber-500 hover:bg-amber-600 text-white"
            >
              {acting === "prepare" ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <PackageCheck className="w-5 h-5 ml-2" />}
              بدء التجهيز
            </Button>
          )}
          {canTransition("ready", order.status, user.role) && (
            <Button
              onClick={() => doTransition("ready")}
              disabled={acting !== null}
              className="w-full h-14 text-base font-bold rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {acting === "ready" ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <Truck className="w-5 h-5 ml-2" />}
              جاهز للتوصيل
            </Button>
          )}

          {order.status === "READY" && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 text-center text-sm text-cyan-700">
              الطلب جاهز — بانتظار الإدارة لتعيين سائق
            </div>
          )}
          {["ASSIGNED", "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED"].includes(order.status) && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center text-sm text-green-700">
              تم تسليم الطلب للإدارة لتوصيله
            </div>
          )}
        </div>
      </div>
    </div>
  );
}