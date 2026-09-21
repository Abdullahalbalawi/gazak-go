import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, RotateCcw, ArrowLeftRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function ReturnExchangeDialog({ order, open, onOpenChange, onDone }) {
  const [mode, setMode] = useState("return");
  const [returnQtys, setReturnQtys] = useState({});
  const [newItems, setNewItems] = useState([{ product_id: "", quantity: 1 }]);
  const [products, setProducts] = useState([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("return");
      setReturnQtys({});
      setNewItems([{ product_id: "", quantity: 1 }]);
      setNote("");
    }
  }, [open]);

  useEffect(() => {
    if (open && mode === "exchange") {
      base44.entities.Product.list().then(setProducts).catch(() => {});
    }
  }, [open, mode]);

  const handleSubmit = async () => {
    const items = [];
    order.items.forEach((item, idx) => {
      const qty = returnQtys[idx];
      if (qty && qty > 0) {
        items.push({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: qty,
        });
      }
    });

    if (items.length === 0) {
      toast({ title: "حدد عنصراً واحداً على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order_id: order.id,
        action: mode,
        items,
        note: note.trim(),
      };

      if (mode === "exchange") {
        payload.newItems = newItems
          .filter((ni) => ni.product_id && ni.quantity > 0)
          .map((ni) => {
            const p = products.find((p) => p.id === ni.product_id);
            return {
              product_id: ni.product_id,
              product_name: p?.name || "",
              quantity: ni.quantity,
            };
          });

        if (payload.newItems.length === 0) {
          toast({ title: "حدد منتجاً بديلاً", variant: "destructive" });
          setSaving(false);
          return;
        }
      }

      await base44.functions.invoke("processReturnExchange", payload);
      toast({ title: mode === "return" ? "تم تسجيل المرتجع" : "تم تسجيل الاستبدال" });
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast({
        title: "فشل",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>مرتجع / استبدال</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("return")}
              className={cn(
                "flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5",
                mode === "return" ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-700"
              )}
            >
              <RotateCcw className="w-4 h-4" /> مرتجع
            </button>
            <button
              onClick={() => setMode("exchange")}
              className={cn(
                "flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5",
                mode === "exchange" ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-700"
              )}
            >
              <ArrowLeftRight className="w-4 h-4" /> استبدال
            </button>
          </div>

          {/* Return items */}
          <div className="space-y-2">
            <p className="text-sm font-medium">العناصر المرتجعة:</p>
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <span className="text-sm flex-1">{item.product_name} (طلب: {item.quantity})</span>
                <input
                  type="number"
                  min="0"
                  max={item.quantity}
                  value={returnQtys[idx] || ""}
                  onChange={(e) => setReturnQtys({ ...returnQtys, [idx]: parseInt(e.target.value) || 0 })}
                  className="w-16 h-8 rounded-lg border border-border px-2 text-sm text-center"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {/* Exchange new items */}
          {mode === "exchange" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">المنتجات البديلة:</p>
              {newItems.map((ni, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={ni.product_id}
                    onChange={(e) => setNewItems((prev) => prev.map((p, i) => i === idx ? { ...p, product_id: e.target.value } : p))}
                    className="flex-1 h-8 rounded-lg border border-border px-2 text-sm"
                  >
                    <option value="">اختر منتج...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={ni.quantity}
                    onChange={(e) => setNewItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 1 } : p))}
                    className="w-16 h-8 rounded-lg border border-border px-2 text-sm text-center"
                  />
                </div>
              ))}
              <button
                onClick={() => setNewItems([...newItems, { product_id: "", quantity: 1 }])}
                className="text-xs text-primary flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> إضافة منتج
              </button>
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label>ملاحظة (اختياري)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}