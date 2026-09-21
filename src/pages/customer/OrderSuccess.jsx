import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabaseApi } from "@/lib/supabaseApi";
import CustomerHeader from "@/components/CustomerHeader";
import BottomNav from "@/components/BottomNav";
import StatusBadge from "@/components/StatusBadge";
import { CheckCircle2, Loader2, Package } from "lucide-react";

export default function OrderSuccess() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchOrder();
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <CustomerHeader />
      <div className="max-w-md mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : order ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">تم استلام طلبك بنجاح!</h2>
            <p className="text-muted-foreground text-sm mb-6">سنتواصل معك قريباً لتفاصيل التوصيل</p>

            <div className="bg-white rounded-2xl border border-border p-4 w-full space-y-3 text-right">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">رقم الطلب</span>
                <span className="font-mono font-semibold text-sm">#{order.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">الحالة</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">الإجمالي</span>
                <span className="font-bold text-primary">{order.total} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">وقت الطلب</span>
                <span className="text-sm">{new Date(order.created_date).toLocaleString("ar-SA")}</span>
              </div>
            </div>

            <div className="flex gap-3 w-full mt-6">
              <Link
                to="/my-orders"
                className="flex-1 h-12 rounded-2xl border border-border bg-white font-medium text-sm flex items-center justify-center hover:bg-muted"
              >
                طلباتي
              </Link>
              <Link
                to={`/track-order/${order.id}`}
                className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center hover:bg-primary/90"
              >
                <Package className="w-4 h-4 ml-1" />
                متابعة الطلب
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">لم يتم العثور على الطلب</div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}