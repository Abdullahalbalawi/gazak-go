import React from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerHeader from "@/components/CustomerHeader";
import BottomNav from "@/components/BottomNav";
import { useCart } from "@/lib/CartContext";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft } from "lucide-react";
import { Image } from "@/components/ui/image";

const DELIVERY_FEE = 15;

export default function Cart() {
  const { items, updateQty, removeItem, subtotal, count } = useCart();
  const navigate = useNavigate();
  const total = subtotal + (items.length > 0 ? DELIVERY_FEE : 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <CustomerHeader />

      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/" className="p-1 -mr-1">
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Link>
          <h2 className="font-bold text-lg text-foreground">سلة التسوق</h2>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <ShoppingBag className="w-14 h-14 mb-3" />
            <p className="font-medium">سلتك فارغة</p>
            <Link to="/" className="mt-4 text-primary font-medium text-sm hover:underline">
              تصفح المنتجات
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.product_id} className="bg-white rounded-2xl border border-border p-3 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <Image src={item.image} alt={item.product_name} className="w-full h-full" fittingType="fill" />
                    ) : (
                      <span className="text-2xl">🔥</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground truncate">{item.product_name}</h4>
                    <p className="text-sm text-primary font-bold">{item.price} ر.س</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity - 1)}
                        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-sm w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity + 1)}
                        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="mr-auto w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">الإجمالي</p>
                    <p className="font-bold text-sm">{item.total} ر.س</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-border p-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الإجمالي الفرعي</span>
                <span className="font-medium">{subtotal} ر.س</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">رسوم التوصيل</span>
                <span className="font-medium">{DELIVERY_FEE} ر.س</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold">الإجمالي</span>
                <span className="font-bold text-primary text-lg">{total} ر.س</span>
              </div>
            </div>

            <button
              onClick={() => navigate("/checkout")}
              className="w-full mt-4 h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors"
            >
              إتمام الطلب ({count} منتج)
            </button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}