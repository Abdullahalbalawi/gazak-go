import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StaffHeader from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/AuthContext";
import { getDemoDrivers, getDemoOrders, getDemoStats, assignDemoOrderSmart, transitionDemoOrder } from "@/lib/demoMode";
import { canTransition } from "@/lib/orderStatus";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PackageCheck, Truck, UserRound, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ROLE_META = {
  distributor: { title: "لوحة الموزع التجريبية", description: "استلام الطلبات وتجهيزها حتى تصبح جاهزة للتوصيل" },
  driver: { title: "لوحة السائق التجريبية", description: "قبول التوصيل والوصول ثم إتمام التسليم" },
  admin: { title: "لوحة الإدارة التجريبية", description: "مراقبة الطلبات وتجربة الإسناد الذكي" },
};

const ROLE_ROUTES = { customer: "/", distributor: "/distributor", driver: "/driver", admin: "/admin" };

function switchLabel(role) {
  return { customer: "العميل", distributor: "الموزع", driver: "السائق", admin: "المدير" }[role] || role;
}

export default function DemoOperations() {
  const { user, switchDemoRole } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(() => getDemoOrders());
  const [drivers] = useState(() => getDemoDrivers());
  const [selectedDrivers, setSelectedDrivers] = useState({});
  const [busy, setBusy] = useState(null);
  const role = user?.role || "customer";
  const meta = ROLE_META[role];

  const refresh = () => setOrders(getDemoOrders());

  const changeRole = (nextRole) => {
    switchDemoRole(nextRole);
    navigate(ROLE_ROUTES[nextRole]);
    window.setTimeout(refresh, 0);
  };

  const act = (order, action) => {
    const transition = {
      accept: "ACCEPTED",
      prepare: "PREPARING",
      ready: "READY",
      startDelivery: "OUT_FOR_DELIVERY",
      arrive: "ARRIVED",
      deliver: "DELIVERED",
    }[action];
    if (!transition) return;
    setBusy(order.id + action);
    try {
      transitionDemoOrder(order.id, transition, role);
      refresh();
      toast({ title: "تم تحديث الطلب", description: `${order.id} أصبح ${transition}` });
    } catch (error) {
      toast({ title: "تعذر تحديث الطلب", description: error.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const assign = (order) => {
    const driverId = selectedDrivers[order.id];
    if (!driverId) {
      toast({ title: "اختر سائقاً أولاً", variant: "destructive" });
      return;
    }
    setBusy(order.id + "assign");
    try {
      assignDemoOrderSmart(order.id, driverId);
      refresh();
      toast({ title: "تم الإسناد الذكي", description: "تم التحقق من تعارض المسار ووقت التسليم." });
    } catch (error) {
      toast({ title: "تم رفض الإسناد الذكي", description: error.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const visibleOrders = useMemo(() => {
    if (role === "driver") return orders.filter((o) => o.driver_id === user.id);
    return orders;
  }, [orders, role, user?.id]);

  if (role === "customer") {
    navigate("/");
    return null;
  }

  const stats = getDemoStats();

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <StaffHeader title={meta?.title || "الوضع التجريبي"} />
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <UserRound className="w-5 h-5 text-amber-700 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-amber-900">تجربة الأدوار والطلبات</p>
              <p className="text-xs text-amber-800 mt-1">{meta?.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.keys(ROLE_ROUTES).map((r) => (
              <button key={r} onClick={() => changeRole(r)} className={`px-3 py-2 rounded-lg text-xs font-semibold border ${r === role ? "bg-amber-700 text-white border-amber-700" : "bg-white text-amber-900 border-amber-200"}`}>
                {switchLabel(r)}
              </button>
            ))}
          </div>
        </div>

        {role === "admin" && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              ["طلبات جديدة", stats.new], ["قيد التنفيذ", stats.inProgress], ["خرج للتوصيل", stats.outForDelivery], ["مكتملة", stats.completed], ["ملغاة", stats.cancelled],
            ].map(([label, value]) => <div key={label} className="bg-white border rounded-xl p-3"><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div><h2 className="font-bold">الطلبات</h2><p className="text-xs text-muted-foreground">البيانات محفوظة محلياً في هذا المتصفح</p></div>
            <Button variant="outline" size="sm" onClick={refresh}>تحديث</Button>
          </div>
          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <div key={order.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-10)}</p><p className="font-semibold mt-1">{order.customer_name}</p><p className="text-xs text-muted-foreground">{order.address}</p></div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-3 text-sm space-y-1">{order.items?.map((item, index) => <div key={index} className="flex justify-between"><span>{item.product_name} × {item.quantity}</span><span>{item.total} ر.س</span></div>)}</div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm"><span>الإجمالي</span><strong>{order.total} ر.س</strong></div>

                {role === "distributor" && canTransition("accept", order.status, role) && <Button onClick={() => act(order, "accept")} disabled={busy !== null} className="w-full mt-3 h-11"><CheckCircle2 className="w-4 h-4 ml-2"/>قبول الطلب</Button>}
                {role === "distributor" && canTransition("prepare", order.status, role) && <Button onClick={() => act(order, "prepare")} disabled={busy !== null} className="w-full mt-3 h-11"><PackageCheck className="w-4 h-4 ml-2"/>بدء التجهيز</Button>}
                {role === "distributor" && canTransition("ready", order.status, role) && <Button onClick={() => act(order, "ready")} disabled={busy !== null} className="w-full mt-3 h-11"><Truck className="w-4 h-4 ml-2"/>جاهز للتوصيل</Button>}

                {role === "admin" && order.status === "READY" && <div className="mt-3 rounded-xl bg-cyan-50 border border-cyan-200 p-3"><p className="text-sm font-semibold mb-2">Smart Dispatch</p><div className="flex gap-2"><select value={selectedDrivers[order.id] || ""} onChange={(e) => setSelectedDrivers((prev) => ({ ...prev, [order.id]: e.target.value }))} className="flex-1 h-10 border rounded-lg px-2 bg-white text-sm"><option value="">اختيار السائق</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}</select><Button onClick={() => assign(order)} disabled={busy !== null} className="h-10">إسناد</Button></div></div>}

                {role === "driver" && canTransition("startDelivery", order.status, role) && <Button onClick={() => act(order, "startDelivery")} disabled={busy !== null} className="w-full mt-3 h-11"><Truck className="w-4 h-4 ml-2"/>بدء التوصيل</Button>}
                {role === "driver" && canTransition("arrive", order.status, role) && <Button onClick={() => act(order, "arrive")} disabled={busy !== null} className="w-full mt-3 h-11"><PackageCheck className="w-4 h-4 ml-2"/>وصلت للعميل</Button>}
                {role === "driver" && canTransition("deliver", order.status, role) && <Button onClick={() => act(order, "deliver")} disabled={busy !== null} className="w-full mt-3 h-11"><CheckCircle2 className="w-4 h-4 ml-2"/>تم التسليم</Button>}

                {role === "admin" && ["NEW", "ACCEPTED", "PREPARING"].includes(order.status) && <div className="grid grid-cols-3 gap-2 mt-3">{[["ACCEPTED", "قبول"], ["PREPARING", "تجهيز"], ["READY", "جاهز"]].map(([status, label]) => <Button key={status} variant="outline" disabled={busy !== null} onClick={() => { const action = status === "ACCEPTED" ? "accept" : status === "PREPARING" ? "prepare" : "ready"; act(order, action); }}>{label}</Button>)}</div>}

                {order.driver_id && <p className="text-xs text-muted-foreground mt-3">السائق: {drivers.find((d) => d.id === order.driver_id)?.full_name || order.driver_id}</p>}
                {order.status === "DELIVERED" && <div className="mt-3 text-xs text-green-700 bg-green-50 rounded-lg p-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>اكتملت دورة الطلب التجريبية</div>}
                {order.status === "CANCELLED" && <div className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg p-2 flex items-center gap-2"><RotateCcw className="w-4 h-4"/>تم إلغاء الطلب</div>}
              </div>
            ))}
          </div>
        </div>

        <Link to="/" className="inline-flex text-sm text-primary font-medium">العودة لتجربة العميل</Link>
      </div>
    </div>
  );
}
