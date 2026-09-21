import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import StaffHeader from "@/components/StaffHeader";
import { Image } from "@/components/ui/image";
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
import { Loader2, Plus, Pencil, Trash2, Flame, Package } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  image: "",
  status: "ACTIVE",
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchProducts = async () => {
    try {
      const list = await supabaseApi.entities.Product.list("-created_date", 100);
      setProducts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price?.toString() || "",
      image: product.image || "",
      status: product.status || "ACTIVE",
    });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.price === "") {
      toast({ title: "الاسم والسعر مطلوبان", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        image: form.image.trim() || null,
        status: form.status,
      };
      if (editing) {
        await supabaseApi.entities.Product.update(editing.id, data);
        toast({ title: "تم تحديث المنتج" });
      } else {
        await supabaseApi.entities.Product.create(data);
        toast({ title: "تمت إضافة المنتج" });
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (err) {
      toast({
        title: "فشل الحفظ",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    setDeleting(product.id);
    try {
      // Check if any order references this product
      const orders = await supabaseApi.entities.Order.list("-created_date", 200);
      const linked = orders.some((o) =>
        o.items?.some((i) => i.product_id === product.id)
      );

      if (linked) {
        // Deactivate instead of delete
        await supabaseApi.entities.Product.update(product.id, { status: "INACTIVE" });
        toast({
          title: "تم إيقاف المنتج بدلاً من حذفه",
          description: "المنتج مرتبط بطلبات سابقة، لذا تم إيقافه بدلاً من حذفه.",
        });
      } else {
        await supabaseApi.entities.Product.delete(product.id);
        toast({ title: "تم حذف المنتج" });
      }
      fetchProducts();
    } catch (err) {
      toast({
        title: "فشل الحذف",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const toggleStatus = async (product) => {
    const newStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await supabaseApi.entities.Product.update(product.id, { status: newStatus });
      toast({
        title: newStatus === "ACTIVE" ? "تم تفعيل المنتج" : "تم إيقاف المنتج",
      });
      fetchProducts();
    } catch (err) {
      toast({
        title: "فشل التغيير",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="إدارة المنتجات" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-foreground">المنتجات</h2>
          <Button onClick={openAdd} className="h-10">
            <Plus className="w-4 h-4 ml-1" />
            إضافة منتج
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mb-2" />
            <p>لا توجد منتجات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-border p-3 flex gap-3"
              >
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full"
                      fittingType="fill"
                    />
                  ) : (
                    <Flame className="w-8 h-8 text-orange-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                        product.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {product.status === "ACTIVE" ? "متاح" : "موقوف"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="font-bold text-primary">
                      {product.price} ر.س
                    </span>
                    <span className="text-muted-foreground">
                      المخزون: {product.stock}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => openEdit(product)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium hover:bg-gray-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      تعديل
                    </button>
                    <button
                      onClick={() => toggleStatus(product)}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium hover:bg-gray-200"
                    >
                      {product.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      disabled={deleting === product.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                    >
                      {deleting === product.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "تعديل منتج" : "إضافة منتج جديد"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم المنتج *</Label>
              <Input
                id="name"
                placeholder="مثال: أسطوانة غاز 12 كجم"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">الوصف / الحجم</Label>
              <Input
                id="description"
                placeholder="مثال: أسطوانة غاز سعة 12 كجم"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">السعر (ر.س) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="45"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">رابط الصورة</Label>
              <Input
                id="image"
                type="url"
                placeholder="https://..."
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="ACTIVE">متاح (ACTIVE)</option>
                <option value="INACTIVE">موقوف (INACTIVE)</option>
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editing ? (
                  "حفظ التعديلات"
                ) : (
                  "إضافة"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}