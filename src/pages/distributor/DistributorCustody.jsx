import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import StaffHeader from "@/components/StaffHeader";
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
import { Loader2, ArrowLeft, Package } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { TX_TYPE_LABELS, TX_TYPE_STYLES } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export default function DistributorCustody() {
  const { user } = useAuth();
  const [custody, setCustody] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, product: null });
  const [form, setForm] = useState({ driver_id: "", quantity: "", note: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [cust, txns, drvs] = await Promise.all([
        base44.entities.Custody.list("-created_date", 100),
        base44.entities.CylinderTransaction.list("-created_date", 100),
        base44.entities.User.filter({ role: "driver" }, "-created_date", 100),
      ]);
      setCustody(cust);
      setTransactions(txns);
      setDrivers(drvs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const openDialog = (product) => {
    setDialog({ open: true, product });
    setForm({ driver_id: "", quantity: "", note: "" });
  };

  const handleTransfer = async () => {
    if (!form.driver_id) {
      toast({ title: "اختر سائقاً", variant: "destructive" });
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast({ title: "الكمية غير صالحة", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("manageInventory", {
        action: "transferToDriver",
        product_id: dialog.product.product_id,
        quantity: Number(form.quantity),
        counterparty_id: form.driver_id,
        note: form.note.trim(),
      });
      toast({ title: "تم التحويل للسائق" });
      setDialog({ open: false, product: null });
      fetchData();
    } catch (e) {
      toast({
        title: "فشل التحويل",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="عهدتي" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Custody Section ── */}
            <h2 className="font-bold text-lg text-foreground mb-3">عهدتي</h2>
            {custody.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mb-2" />
                <p>لا توجد عهدة لديك حالياً</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {custody.map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-sm text-foreground">{c.product_name}</h3>
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-cyan-100 text-cyan-700">
                        {c.quantity}
                      </span>
                    </div>
                    {c.quantity > 0 && (
                      <button
                        onClick={() => openDialog(c)}
                        className="flex items-center justify-center gap-1 w-full h-9 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> تحويل لسائق
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Transactions Section ── */}
            <h2 className="font-bold text-lg text-foreground mb-3">حركاتي</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا توجد حركات</div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-white rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        TX_TYPE_STYLES[tx.type] || "bg-gray-100 text-gray-700"
                      )}>
                        {TX_TYPE_LABELS[tx.type] || tx.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.created_date).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{tx.product_name} × {tx.quantity}</p>
                    {tx.counterparty_name && (
                      <p className="text-xs text-muted-foreground">الجهة: {tx.counterparty_name}</p>
                    )}
                    {tx.note && (
                      <p className="text-xs text-muted-foreground italic">"{tx.note}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Transfer to Driver Dialog ── */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ ...dialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تحويل لسائق</DialogTitle>
          </DialogHeader>
          {dialog.product && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-medium">{dialog.product.product_name}</p>
                <p className="text-xs text-muted-foreground">المتاح: {dialog.product.quantity}</p>
              </div>
              <div className="space-y-2">
                <Label>السائق</Label>
                <select
                  value={form.driver_id}
                  onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">اختر سائقاً...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name || d.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>الكمية</Label>
                <Input
                  type="number" min="1" max={dialog.product.quantity}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div className="space-y-2">
                <Label>ملاحظة (اختياري)</Label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog({ ...dialog, open: false })}>
                  إلغاء
                </Button>
                <Button onClick={handleTransfer} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "تحويل"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}