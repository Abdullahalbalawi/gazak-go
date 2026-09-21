import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { useAuth } from "@/lib/AuthContext";
import StaffHeader from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import OrderHistoryTimeline from "@/components/OrderHistoryTimeline";
import { canTransition } from "@/lib/orderStatus";
import ReturnExchangeDialog from "@/components/ReturnExchangeDialog";
import { Loader2, MapPin, Phone, PackageCheck, Navigation, CheckCircle2, Truck, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

export default function DriverDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [custody, setCustody] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [returnDialog, setReturnDialog] = useState({ open: false, order: null });

  const fetchOrders = async () => {
    try {
      // RLS تعرض الطلبات المسندة للسائق فقط
      const list = await supabaseApi.entities.Order.filter(
        { driver_id: user.id },
        "-created_date",
        50
      );
      setOrders(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustody = async () => {
    try {
      const list = await supabaseApi.entities.Custody.list("-created_date", 50);
      setCustody(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchCustody();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !navigator.geolocation) return undefined;
    let mounted = true;
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!mounted) return;
          try {
            await supabaseApi.functions.invoke("updateDriverLocation", {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy_m: position.coords.accuracy,
              heading: position.coords.heading,
              speed_kmh: position.coords.speed == null ? null : position.coords.speed * 3.6,
            });
          } catch (e) {
            console.debug("Driver location update failed:", e);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      );
    };
    sendLocation();
    const interval = setInterval(sendLocation, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const doTransition = async (order, action) => {
    const t = canTransition(action, order.status, user.role);
    if (!t) return;
    setActing(order.id + action);
    try {
      const res = await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: order.id,
        action,
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? res.data.order : o)));
      toast({ title: "تم تحديث الحالة" });
    } catch (e) {
      toast({ title: "فشل التحديث", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const activeOrders = orders.filter((o) =>
    ["ASSIGNED", "OUT_FOR_DELIVERY", "ARRIVED"].includes(o.status)
  );
  const completedOrders = orders.filter((o) => o.status === "DELIVERED");

  const renderOrderCard = (order) => {
    const mapsLink = order.latitude && order.longitude
      ? `https://www.google.com/maps?q=${order.latitude},${order.longitude}`
      : null;

    return (
      <div key={order.id} className="bg-white rounded-2xl border border-border p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p>
            <p className="font-semibold text-sm text-foreground mt-0.5">{order.customer_name}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="space-y-2 text-sm mb-3">
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
          <div className="border-t border-border pt-2 space-y-1">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{item.product_name} × {item.quantity}</span>
                <span className="text-muted-foreground">{item.total} ر.س</span>
              </div>
            ))}
          </div>
          {order.return_count > 0 && (
            <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
              <RotateCcw className="w-4 h-4" />
              استلام {order.return_count} أسطوانة فارغة من العميل
            </div>
          )}
          <div className="flex justify-between font-bold pt-1">
            <span>الإجمالي</span>
            <span className="text-primary">{order.total} ر.س</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">طريقة الدفع</span>
            <span>{order.payment_method === "CASH" ? "نقداً عند الاستلام" : "بطاقة"}</span>
          </div>
        </div>

        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border text-sm font-medium hover:bg-muted mb-2"
          >
            <Navigation className="w-4 h-4 text-primary" />
            فتح الموقع في الخرائط
          </a>
        )}

        <div className="space-y-2">
          {canTransition("startDelivery", order.status, user.role) && (
            <Button
              onClick={() => doTransition(order, "startDelivery")}
              disabled={acting !== null}
              className="w-full h-12 font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
            >
              {acting === order.id + "startDelivery" ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Truck className="w-4 h-4 ml-2" />}
              قبول الطلب وبدء التوصيل
            </Button>
          )}
          {canTransition("arrive", order.status, user.role) && (
            <Button
              onClick={() => doTransition(order, "arrive")}
              disabled={acting !== null}
              className="w-full h-12 font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
            >
              {acting === order.id + "arrive" ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <PackageCheck className="w-4 h-4 ml-2" />}
              وصلت للعميل
            </Button>
          )}
          {canTransition("deliver", order.status, user.role) && (
            <Button
              onClick={() => doTransition(order, "deliver")}
              disabled={acting !== null}
              className="w-full h-12 font-bold rounded-xl bg-green-600 hover:bg-green-700 text-white"
            >
              {acting === order.id + "deliver" ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
              تم التسليم
            </Button>
          )}
        </div>

        <OrderHistoryTimeline orderId={order.id} />

        {order.status === "DELIVERED" && (
          <Button
            onClick={() => setReturnDialog({ open: true, order })}
            variant="outline"
            className="w-full h-10 rounded-xl text-sm font-medium mt-2"
          >
            <RotateCcw className="w-4 h-4 ml-2" />
            مرتجع / استبدال
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="لوحة السائق" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {custody.length > 0 && (
              <>
                <h3 className="font-bold text-sm text-foreground mb-3">عهدتي</h3>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {custody.map((c) => (
                    <div key={c.id} className="bg-white rounded-xl border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{c.product_name}</p>
                      <p className="text-lg font-bold text-cyan-700">{c.quantity}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeOrders.length > 0 && (
              <>
                <h3 className="font-bold text-sm text-foreground mb-3">الطلبات النشطة</h3>
                <div className="space-y-3 mb-6">
                  {activeOrders.map(renderOrderCard)}
                </div>
              </>
            )}

            {activeOrders.length === 0 && completedOrders.length === 0 && (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Truck className="w-14 h-14 mb-3" />
                <p className="font-medium">لا توجد طلبات مسندة إليك حالياً</p>
              </div>
            )}

            {completedOrders.length > 0 && (
              <>
                <h3 className="font-bold text-sm text-foreground mb-3">الطلبات المكتملة</h3>
                <div className="space-y-3">
                  {completedOrders.map(renderOrderCard)}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ReturnExchangeDialog
        order={returnDialog.order}
        open={returnDialog.open}
        onOpenChange={(open) => setReturnDialog({ ...returnDialog, open })}
        onDone={fetchOrders}
      />
    </div>
  );
}