import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    if (!open) return;
    setMode("return"); setReturnQtys({}); setNewItems([{ product_id: "", quantity: 1 }]); setNote("");
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "exchange") return;
    supabase.from("products").select("id,name,price,stock,status").eq("status", "ACTIVE").order("name")
      .then(({ data }) => setProducts(data || []));
  }, [open, mode]);

  const handleSubmit = async () => {
    if (!order) return;
    const items = (order.items || []).map((item, idx) => ({ product_id: item.product_id, quantity: Number(returnQtys[idx] || 0) })).filter((i) => i.quantity > 0);
    if (!items.length) { toast({ title: "حدد عنصراً واحداً على الأقل", variant: "destructive" }); return; }
    const replacementItems = mode === "exchange" ? newItems.filter((i) => i.product_id && Number(i.quantity) > 0).map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity) })) : [];
    if (mode === "exchange" && !replacementItems.length) { toast({ title: "حدد منتجاً بديلاً", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("process_return_exchange", {
        p_order_id: order.id, p_action: mode, p_items: items, p_new_items: replacementItems, p_note: note.trim() || null,
      });
      if (error) throw error;
      toast({ title: mode === "return" ? "تم تسجيل المرتجع" : "تم تسجيل الاستبدال" });
      onOpenChange(false); onDone?.();
    } catch (e) { toast({ title: "فشل", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>مرتجع / استبدال</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMode("return")} className={cn("flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5", mode === "return" ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-700")}><RotateCcw className="w-4 h-4" /> مرتجع</button>
            <button onClick={() => setMode("exchange")} className={cn("flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5", mode === "exchange" ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-700")}><ArrowLeftRight className="w-4 h-4" /> استبدال</button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">العناصر المرتجعة:</p>
            {(order.items || []).map((item, idx) => <div key={idx} className="flex items-center justify-between gap-2"><span className="text-sm flex-1">{item.product_name} (طلب: {item.quantity})</span><input type="number" min="0" max={item.quantity} value={returnQtys[idx] || ""} onChange={(e) => setReturnQtys({ ...returnQtys, [idx]: parseInt(e.target.value, 10) || 0 })} className="w-16 h-8 rounded-lg border border-border px-2 text-sm text-center" placeholder="0" /></div>)}
          </div>
          {mode === "exchange" && <div className="space-y-2"><p className="text-sm font-medium">المنتجات البديلة:</p>{newItems.map((ni, idx) => <div key={idx} className="flex gap-2"><select value={ni.product_id} onChange={(e) => setNewItems((prev) => prev.map((p, i) => i === idx ? { ...p, product_id: e.target.value } : p))} className="flex-1 h-8 rounded-lg border border-border px-2 text-sm"><option value="">اختر منتج...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (متوفر: {p.stock})</option>)}</select><input type="number" min="1" value={ni.quantity} onChange={(e) => setNewItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value, 10) || 1 } : p))} className="w-16 h-8 rounded-lg border border-border px-2 text-sm text-center" /></div>)}<button onClick={() => setNewItems([...newItems, { product_id: "", quantity: 1 }])} className="text-xs text-primary flex items-center gap-1"><Plus className="w-3 h-3" /> إضافة منتج</button></div>}
          <div className="space-y-2"><Label>ملاحظة (اختياري)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button><Button onClick={handleSubmit} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد"}</Button></DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
