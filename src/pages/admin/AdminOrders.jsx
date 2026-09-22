import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import StaffHeader from "@/components/StaffHeader";
import StatusBadge from "@/components/StatusBadge";
import OrderHistoryTimeline from "@/components/OrderHistoryTimeline";
import { ORDER_STATUSES, STATUS_LABELS_AR } from "@/lib/orderStatus";
import ReturnExchangeDialog from "@/components/ReturnExchangeDialog";
import { Loader2, MapPin, UserCog, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [changingStatus, setChangingStatus] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState({});
  const [manualStatus, setManualStatus] = useState({});
  const [manualReason, setManualReason] = useState({});
  const [returnDialog, setReturnDialog] = useState({ open: false, order: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, order: null });
  const [deleting, setDeleting] = useState(false);

  const fetchOrders = async () => {
    try {
      const list = await supabaseApi.entities.Order.list("-created_date", 200);
      setOrders(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const list = await supabaseApi.entities.User.filter({ role: "driver" }, "-created_date", 100);
      setDrivers(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleAssign = async (orderId) => {
    const driverId = selectedDriver[orderId];
    if (!driverId) {
      toast({ title: "اختر سائقاً أولاً", variant: "destructive" });
      return;
    }
    setAssigning(orderId);
    try {
      const res = await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: orderId,
        action: "assign",
        extra: { driver_id: driverId },
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data.order : o)));
      toast({ title: "تم تعيين السائق وإسناد الطلب" });
    } catch (e) {
      toast({ title: "فشل التعيين", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setAssigning(null);
    }
  };

  const handleReassign = async (orderId) => {
    const driverId = selectedDriver[orderId];
    if (!driverId) {
      toast({ title: "اختر سائقاً أولاً", variant: "destructive" });
      return;
    }
    setAssigning(orderId);
    try {
      const res = await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: orderId,
        action: "reassign",
        extra: { driver_id: driverId },
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data.order : o)));
      toast({ title: "تم إعادة تعيين السائق" });
    } catch (e) {
      toast({ title: "فشل إعادة التعيين", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setAssigning(null);
    }
  };

  const handleStatusChange = async (orderId, newStatus, reason) => {
    setChangingStatus(orderId);
    try {
      const res = await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: orderId,
        action: "manualStatus",
        extra: { status: newStatus, reason },
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.data.order : o)));
      toast({ title: "تم تغيير الحالة" });
    } catch (e) {
      toast({ title: "فشل التغيير", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setChangingStatus(null);
    }
  };

  const handleDelete = async () => {
    const order = deleteConfirm.order;
    if (!order) return;
    setDeleting(true);
    try {
      await supabaseApi.functions.invoke("updateOrderStatus", {
        order_id: order.id,
        action: "delete",
      });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setExpanded(null);
      toast({ title: "تم حذف الطلب" });
    } catch (e) {
      toast({ title: "فشل الحذف", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteConfirm({ open: false, order: null });
    }
  };

  const getDriverName = (id) => {
    const d = drivers.find((d) => d.id === id);
    return d ? (d.full_name || d.email) : "—";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="إدارة الطلبات" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        <h2 className="font-bold text-lg text-foreground mb-4">جميع الطلبات</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">لا توجد طلبات</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isOpen = expanded === order.id;
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    className="w-full p-4 flex items-center justify-between text-right"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="font-semibold text-sm text-foreground">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.total} ر.س · {new Date(order.created_date).toLocaleDateString("ar-SA")}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                      {/* تفاصيل */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">العميل</p>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الموزع</p>
                          <p className="font-medium">{order.distributor_id ? getDriverName(order.distributor_id) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">السائق</p>
                          <p className="font-medium">{order.driver_id ? getDriverName(order.driver_id) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                          <p className="font-medium">{order.payment_method === "CASH" ? "نقداً" : "بطاقة"}</p>
                        </div>
                      </div>

                      {order.address && (
                        <div className="flex items-start gap-1 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{order.address}</span>
                        </div>
                      )}

                      {/* المنتجات */}
                      <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.product_name} × {item.quantity}</span>
                            <span className="text-muted-foreground">{item.total} ر.س</span>
                          </div>
                        ))}
                        <div className="border-t border-border pt-1 mt-1 flex justify-between font-bold">
                          <span>الإجمالي</span>
                          <span className="text-primary">{order.total} ر.س</span>
                        </div>
                      </div>

                      {/* سجل الحركة */}
                      <OrderHistoryTimeline orderId={order.id} />

                      {/* تعيين سائق للطلبات الجاهزة */}
                      {order.status === "READY" && (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
                          <p className="text-sm font-semibold text-cyan-700 mb-2">تعيين سائق</p>
                          <div className="flex gap-2">
                            <select
                              value={selectedDriver[order.id] || ""}
                              onChange={(e) => setSelectedDriver((p) => ({ ...p, [order.id]: e.target.value }))}
                              className="flex-1 h-10 rounded-lg border border-border bg-white px-2 text-sm"
                            >
                              <option value="">اختر سائقاً...</option>
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>{d.full_name || d.email}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssign(order.id)}
                              disabled={assigning === order.id}
                              className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                              {assigning === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "تعيين"}
                            </button>
                          </div>
                          {drivers.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">لا يوجد سائقون. أضف مستخدماً بدور سائق من صفحة المستخدمين.</p>
                          )}
                        </div>
                      )}

                      {/* إعادة تعيين السائق للطلبات النشطة */}
                      {["ASSIGNED", "OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status) && (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
                          <p className="text-sm font-semibold text-cyan-700 mb-2">إعادة تعيين السائق</p>
                          <div className="flex gap-2">
                            <select
                              value={selectedDriver[order.id] || ""}
                              onChange={(e) => setSelectedDriver((p) => ({ ...p, [order.id]: e.target.value }))}
                              className="flex-1 h-10 rounded-lg border border-border bg-white px-2 text-sm"
                            >
                              <option value="">اختر سائقاً...</option>
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>{d.full_name || d.email}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleReassign(order.id)}
                              disabled={assigning === order.id}
                              className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                              {assigning === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "إعادة التعيين"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* مرتجع / استبدال للطلبات المسلّمة */}
                      {order.status === "DELIVERED" && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                          <p className="text-sm font-semibold text-purple-700 mb-2">مرتجع / استبدال</p>
                          <button
                            onClick={() => setReturnDialog({ open: true, order })}
                            className="w-full h-10 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            تسجيل مرتجع / استبدال
                          </button>
                        </div>
                      )}

                      {/* تغيير الحالة يدويًا */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <p className="text-sm font-semibold text-amber-700">تغيير الحالة يدويًا</p>
                        <select
                          value={manualStatus[order.id] || order.status}
                          onChange={(e) => setManualStatus((p) => ({ ...p, [order.id]: e.target.value }))}
                          className="w-full h-10 rounded-lg border border-border bg-white px-2 text-sm"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS_AR[s]}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="سبب التغيير (اختياري)"
                          value={manualReason[order.id] || ""}
                          onChange={(e) => setManualReason((p) => ({ ...p, [order.id]: e.target.value }))}
                          className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm"
                        />
                        <button
                          onClick={() => handleStatusChange(order.id, manualStatus[order.id] || order.status, manualReason[order.id])}
                          disabled={changingStatus === order.id || (manualStatus[order.id] || order.status) === order.status}
                          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {changingStatus === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                          تأكيد التغيير
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ open: true, order })}
                          className="w-full h-10 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm font-medium hover:bg-red-100 flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          حذف الطلب
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الطلب #{deleteConfirm.order?.id?.slice(-8).toUpperCase()}؟
              سيتم إعادة الكمية المحجوزة إلى المخزون ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReturnExchangeDialog
        order={returnDialog.order}
        open={returnDialog.open}
        onOpenChange={(open) => setReturnDialog({ ...returnDialog, open })}
        onDone={fetchOrders}
      />
    </div>
  );
}
