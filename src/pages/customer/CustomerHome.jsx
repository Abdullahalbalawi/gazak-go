import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import CustomerHeader from "@/components/CustomerHeader";
import BottomNav from "@/components/BottomNav";
import { useCart } from "@/lib/CartContext";
import { Flame, Plus, Loader2, Package } from "lucide-react";
import { Image } from "@/components/ui/image";

export default function CustomerHome() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const [added, setAdded] = useState({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const list = await supabaseApi.entities.Product.filter({ status: "ACTIVE" }, "-created_date", 50);
        setProducts(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAdd = (product) => {
    addItem(product, 1);
    setAdded((p) => ({ ...p, [product.id]: true }));
    setTimeout(() => setAdded((p) => ({ ...p, [product.id]: false })), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <CustomerHeader />

      {/* Hero */}
      <div className="bg-gradient-to-l from-orange-500 to-amber-500 text-white">
        <div className="max-w-md mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-1">اطلب غازك وأوصله لباب بيتك</h2>
          <p className="text-white/90 text-sm">اختر الأسطوانة وأضفها للسلة وأكمل الطلب في دقائق</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <h3 className="font-bold text-lg mb-4 text-foreground">المنتجات</h3>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mb-2" />
            <p>لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-border overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full"
                      fittingType="fill"
                    />
                  ) : (
                    <Flame className="w-12 h-12 text-orange-400" />
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h4 className="font-semibold text-sm text-foreground leading-snug mb-1">{product.name}</h4>
                  {product.cylinder_type && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mb-1 ${product.cylinder_type === "exchange" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {product.cylinder_type === "exchange" ? "استبدال" : "جديدة"}
                    </span>
                  )}
                  {product.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-primary">{product.price} <span className="text-xs font-normal">ر.س</span></span>
                    <button
                      onClick={() => handleAdd(product)}
                      disabled={product.stock <= 0}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                        added[product.id]
                          ? "bg-green-500 text-white"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      } disabled:opacity-50`}
                      aria-label="أضف للسلة"
                    >
                      {added[product.id] ? "✓" : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                  {product.stock <= 0 && (
                    <p className="text-xs text-red-500 mt-1">نفذت الكمية</p>
                  )}
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