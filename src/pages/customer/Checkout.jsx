import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabaseApi } from "@/lib/supabaseApi";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";
import CustomerHeader from "@/components/CustomerHeader";
import LocationPicker from "@/components/LocationPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CreditCard, Banknote, CheckCircle2 } from "lucide-react";

const DELIVERY_FEE = 15;

export default function Checkout() {
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const returnCount = items.filter((i) => i.cylinder_type === "exchange").reduce((s, i) => s + i.quantity, 0);

  const [phone, setPhone] = useState(user?.phone || "");
  const [name, setName] = useState(user?.full_name || "");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = subtotal + DELIVERY_FEE;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (items.length === 0) {
      setError("سلتك فارغة");
      return;
    }
    if (!phone.trim() || !name.trim() || !address.trim()) {
      setError("يرجى تعبئة جميع الحقول");
      return;
    }
    setSubmitting(true);
    try {
      // تحديث ملف المستخدم بالاسم والجوال إن لزم
      if (user && (!user.phone || !user.full_name)) {
        try {
          await supabaseApi.auth.updateMe({ phone: phone.trim(), full_name: name.trim() });
        } catch {
          // غير حرج
        }
      }

      const res = await supabaseApi.functions.invoke("createOrder", {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        address: address.trim(),
        latitude,
        longitude,
        payment_method: paymentMethod,
      });

      const order = res.data.order;

      clearCart();
      navigate("/order-success/" + order.id);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "فشل إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">سلتك فارغة</p>
          <Link to="/" className="text-primary font-medium hover:underline">تصفح المنتجات</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <CustomerHeader />
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/cart" className="p-1 -mr-1">
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Link>
          <h2 className="font-bold text-lg text-foreground">إتمام الطلب</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* بيانات العميل */}
          <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">بيانات التواصل</h3>
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input
                id="name"
                placeholder="الاسم الكامل"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12"
                required
              />
            </div>
          </div>

          {/* العنوان والموقع */}
          <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">عنوان التوصيل</h3>
            <LocationPicker
              address={address}
              setAddress={setAddress}
              latitude={latitude}
              setLatitude={setLatitude}
              longitude={longitude}
              setLongitude={setLongitude}
            />
          </div>

          {/* مراجعة الطلب */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">مراجعة الطلب</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span className="text-foreground">{item.product_name} × {item.quantity}</span>
                  <span className="font-medium">{item.total} ر.س</span>
                </div>
              ))}
              {returnCount > 0 && (
                <div className="flex justify-between text-sm text-blue-600 font-medium pt-1">
                  <span>أسطوانات فارغة للاستلام</span>
                  <span>{returnCount}</span>
                </div>
              )}
            </div>
            <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإجمالي الفرعي</span>
                <span>{subtotal} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">رسوم التوصيل</span>
                <span>{DELIVERY_FEE} ر.س</span>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span>الإجمالي</span>
                <span className="text-primary">{total} ر.س</span>
              </div>
            </div>
          </div>

          {/* طريقة الدفع */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">طريقة الدفع</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  paymentMethod === "CASH" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Banknote className={`w-7 h-7 ${paymentMethod === "CASH" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">نقداً عند الاستلام</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  paymentMethod === "CARD" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <CreditCard className={`w-7 h-7 ${paymentMethod === "CARD" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">بطاقة</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          <Button type="submit" disabled={submitting} className="w-full h-14 text-base font-bold rounded-2xl">
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                جاري تأكيد الطلب...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 ml-2" />
                تأكيد الطلب — {total} ر.س
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}