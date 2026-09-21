import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StaffHeader from "@/components/StaffHeader";
import { Loader2, Package, Truck, CheckCircle2, XCircle, Clock, Users, ClipboardList, Flame, Boxes } from "lucide-react";

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const list = await base44.entities.Order.list("-created_date", 200);
      setOrders(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  const stats = {
    new: orders.filter((o) => o.status === "NEW").length,
    inProgress: orders.filter((o) => ["ACCEPTED", "PREPARING", "READY", "ASSIGNED"].includes(o.status)).length,
    outForDelivery: orders.filter((o) => ["OUT_FOR_DELIVERY", "ARRIVED"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
  };

  const cards = [
    { label: "طلبات جديدة", value: stats.new, icon: Package, color: "bg-blue-500", textColor: "text-blue-600", bgLight: "bg-blue-50" },
    { label: "قيد التنفيذ", value: stats.inProgress, icon: Clock, color: "bg-amber-500", textColor: "text-amber-600", bgLight: "bg-amber-50" },
    { label: "خرج للتوصيل", value: stats.outForDelivery, icon: Truck, color: "bg-orange-500", textColor: "text-orange-600", bgLight: "bg-orange-50" },
    { label: "مكتملة", value: stats.completed, icon: CheckCircle2, color: "bg-green-500", textColor: "text-green-600", bgLight: "bg-green-50" },
    { label: "ملغاة", value: stats.cancelled, icon: XCircle, color: "bg-red-500", textColor: "text-red-600", bgLight: "bg-red-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="لوحة الإدارة" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        <h2 className="font-bold text-lg text-foreground mb-4">نظرة عامة</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-white rounded-2xl border border-border p-4">
                    <div className={`w-10 h-10 rounded-xl ${card.bgLight} flex items-center justify-center mb-2`}>
                      <Icon className={`w-5 h-5 ${card.textColor}`} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/orders" className="bg-white rounded-2xl border border-border p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors">
                <ClipboardList className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-foreground">الطلبات</span>
              </Link>
              <Link to="/admin/products" className="bg-white rounded-2xl border border-border p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors">
                <Flame className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-foreground">المنتجات</span>
              </Link>
              <Link to="/admin/users" className="bg-white rounded-2xl border border-border p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors">
                <Users className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-foreground">المستخدمون</span>
              </Link>
              <Link to="/admin/inventory" className="bg-white rounded-2xl border border-border p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors">
                <Boxes className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-foreground">المخزون</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}