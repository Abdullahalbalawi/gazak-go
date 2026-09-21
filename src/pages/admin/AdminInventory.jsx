import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
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
import { Loader2, Plus, Minus, ArrowLeft, Package } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { TX_TYPE_LABELS, TX_TYPE_STYLES, TX_TYPES } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "stock", label: "المخزون الرئيسي" },
  { key: "distributors", label: "عهدات الموزعين" },
  { key: "drivers", label: "عهدات السائقين" },
  { key: "transactions", label: "سجل الحركات" },
];

const DIALOG_TITLES = {
  restock: "تزويد المخزون",
  adjust: "تسوية المخزون",
  transferToDistributor: "تحويل لموزع",
  transferToDriver: "تحويل لسائق",
};

export default function AdminInventory() {
  const [tab, setTab] = useState("stock");
  const [products, setProducts] = useState([]);
  const [custody, setCustody] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState("");
  const [dialog, setDialog] = useState({ open: false, action: null, product: null });
  const [form, setForm] = useState({ quantity: "", delta: "", counterparty_id: "", note: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [prods, cust, txns, usrs] = await Promise.all([
        supabaseApi.entities.Product.list("-created_date", 100),
        supabaseApi.entities.Custody.list("-created_date", 200),
        supabaseApi.entities.CylinderTransaction.list("-created_date", 200),
        supabaseApi.entities.User.list("-created_date", 200),
      ]);
      setProducts(prods);
      setCustody(cust);
      setTransactions(txns);
      setUsers(usrs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const distributors = users.filter((u) => u.role === "distributor");
  const drivers = users.filter((u) => u.role === "driver");

  const custodyByUser = {};
  custody.forEach((c) => {
    if (!custodyByUser[c.user_id]) {
      custodyByUser[c.user_id] = { userName: c.user_name, role: c.user_role, items: [] };
    }
    custodyByUser[c.user_id].items.push(c);
  });

  const openDialog = (action, product) => {
    setDialog({ open: true, action, product });
    setForm({ quantity: "", delta: "", counterparty_id: "", note: "" });
  };

  const handleSave = async () => {
    const { action, product } = dialog;
    if (!action || !product) return;

    const isNoteRequired = action === "restock" || action === "adjust";
    if (isNoteRequired && !form.note.trim()) {
      toast({ title: "السبب إلزامي", variant: "destructive" });
      return;
    }
    if ((action === "transferToDistributor" || action === "transferToDriver") && !form.counterparty_id) {
      toast({ title: "اختر الجهة", variant: "destructive" });
      return;
    }

    const qty = action === "adjust" ? Number(form.delta) : Number(form.quantity);
    if (!qty || qty === 0) {
      toast({ title: "الكمية غير صالحة", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = { action, product_id: product.id, note: form.note.trim() };
      if (action === "restock") payload.quantity = Number(form.quantity);
      if (action === "adjust") payload.delta = Number(form.delta);
      if (action === "transferToDistributor" || action === "transferToDriver") {
        payload.quantity = Number(form.quantity);
        payload.counterparty_id = form.counterparty_id;
      }

      await supabaseApi.functions.invoke("manageInventory", payload);
      toast({ title: "تمت العملية بنجاح" });
      setDialog({ open: false, action: null, product: null });
      fetchData();
    } catch (e) {
      toast({
        title: "فشل العملية",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredTx = txFilter ? transactions.filter((t) => t.type === txFilter) : transactions;

  const renderCustodyList = (userList) => {
    if (userList.length === 0) {
      return <div className="text-center py-12 text-muted-foreground">لا يوجد مستخدمون</div>;
    }
    return userList.map((u) => {
      const cust = custodyByUser[u.id];
      return (
        <div key={u.id} className="bg-white rounded-2xl border border-border p-4">
          <h3 className="font-semibold text-sm text-foreground mb-2">
            {u.full_name || u.email}
          </h3>
          {cust && cust.items.length > 0 ? (
            <div className="space-y-1">
              {cust.items.map((c) => (
                <div key={c.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                  <span>{c.product_name}</span>
                  <span className="font-bold">{c.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">لا توجد عهدة</p>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="إدارة المخزون" />

      {/* Tabs */}
      <div className="sticky top-14 z-30 bg-white border-b border-border">
        <div className="max-w-3xl mx-auto flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Main Stock Tab ── */}
            {tab === "stock" && (
              <div className="space-y-3">
                {products.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mb-2" />
                    <p>لا توجد منتجات</p>
                  </div>
                ) : (
                  products.map((p) => (
                    <div key={p.id} className="bg-white rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{p.name}</h3>
                          <p className="text-xs text-muted-foreground">{p.price} ر.س</p>
                        </div>
                      <div className="text-left">
                        <div className="flex flex-wrap gap-1.5 justify-end mb-1">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            {p.stock || 0} متاح
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            {p.reserved_stock || 0} محجوز
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            {p.sold_stock || 0} مباع
                          </span>
                        </div>
                        {(p.stock || 0) <= (p.low_stock_threshold ?? 10) && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            مخزون منخفض
                          </span>
                        )}
                      </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openDialog("restock", p)}
                          className="flex items-center justify-center gap-1 h-9 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100"
                        >
                          <Plus className="w-3.5 h-3.5" /> تزويد
                        </button>
                        <button
                          onClick={() => openDialog("adjust", p)}
                          className="flex items-center justify-center gap-1 h-9 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
                        >
                          <Minus className="w-3.5 h-3.5" /> تسوية
                        </button>
                        <button
                          onClick={() => openDialog("transferToDistributor", p)}
                          className="flex items-center justify-center gap-1 h-9 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-medium hover:bg-cyan-100"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> تحويل لموزع
                        </button>
                        <button
                          onClick={() => openDialog("transferToDriver", p)}
                          className="flex items-center justify-center gap-1 h-9 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" /> تحويل لسائق
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Distributor Custody Tab ── */}
            {tab === "distributors" && (
              <div className="space-y-4">{renderCustodyList(distributors)}</div>
            )}

            {/* ── Driver Custody Tab ── */}
            {tab === "drivers" && (
              <div className="space-y-4">{renderCustodyList(drivers)}</div>
            )}

            {/* ── Transactions Tab ── */}
            {tab === "transactions" && (
              <div className="space-y-3">
                <select
                  value={txFilter}
                  onChange={(e) => setTxFilter(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm"
                >
                  <option value="">كل الحركات</option>
                  {TX_TYPES.map((t) => (
                    <option key={t} value={t}>{TX_TYPE_LABELS[t]}</option>
                  ))}
                </select>

                {filteredTx.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">لا توجد حركات</div>
                ) : (
                  filteredTx.map((tx) => (
                    <div key={tx.id} className="bg-white rounded-2xl border border-border p-3">
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
                      <p className="text-sm font-medium text-foreground">
                        {tx.product_name} × {tx.quantity}
                      </p>
                      {(tx.counterparty_name || tx.order_id) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tx.counterparty_name && `الجهة: ${tx.counterparty_name}`}
                          {tx.counterparty_name && tx.order_id && " · "}
                          {tx.order_id && `طلب: #${tx.order_id.slice(-6).toUpperCase()}`}
                        </p>
                      )}
                      {tx.performed_by_name && (
                        <p className="text-xs text-muted-foreground">
                          بواسطة: {tx.performed_by_name}
                        </p>
                      )}
                      {tx.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{tx.note}"</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Action Dialog ── */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ ...dialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{DIALOG_TITLES[dialog.action]}</DialogTitle>
          </DialogHeader>
          {dialog.product && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-medium">{dialog.product.name}</p>
                <p className="text-xs text-muted-foreground">المتاح: {dialog.product.stock || 0} · المحجوز: {dialog.product.reserved_stock || 0}</p>
              </div>

              {dialog.action === "restock" && (
                <div className="space-y-2">
                  <Label>الكمية</Label>
                  <Input
                    type="number" min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="50"
                  />
                </div>
              )}

              {dialog.action === "adjust" && (
                <div className="space-y-2">
                  <Label>التغيير (+ للزيادة / - للنقص)</Label>
                  <Input
                    type="number"
                    value={form.delta}
                    onChange={(e) => setForm({ ...form, delta: e.target.value })}
                    placeholder="-5 أو +10"
                  />
                </div>
              )}

              {(dialog.action === "transferToDistributor" || dialog.action === "transferToDriver") && (
                <>
                  <div className="space-y-2">
                    <Label>{dialog.action === "transferToDistributor" ? "الموزع" : "السائق"}</Label>
                    <select
                      value={form.counterparty_id}
                      onChange={(e) => setForm({ ...form, counterparty_id: e.target.value })}
                      className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">اختر...</option>
                      {(dialog.action === "transferToDistributor" ? distributors : drivers).map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>الكمية</Label>
                    <Input
                      type="number" min="1"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>
                  السبب / الملاحظة
                  {(dialog.action === "restock" || dialog.action === "adjust") ? " *" : ""}
                </Label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="سبب التزويد/التسوية..."
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog({ ...dialog, open: false })}>
                  إلغاء
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}