import { base44 } from "@/api/base44Client";
import { CUSTOMER_NOTIFICATIONS } from "@/lib/orderStatus";

// إنشاء إشعار داخلي لمستخدم معين
export async function createNotification({ userId, title, body, orderId }) {
  if (!userId) return;
  try {
    await base44.entities.Notification.create({
      user_id: userId,
      title,
      body: body || "",
      order_id: orderId || "",
      read: false,
    });
  } catch (e) {
    // الإشعار لا يفلق التدفق
    console.error("Notification create failed:", e);
  }
}

// إشعار العميل عند تغير حالة الطلب
export async function notifyCustomerOnStatus(order) {
  const n = CUSTOMER_NOTIFICATIONS[order.status];
  if (!n || !order.customer_id) return;
  await createNotification({ userId: order.customer_id, title: n.title, body: n.body, orderId: order.id });
}

// إشعار السائق عند إسناد طلب جديد
export async function notifyDriverAssigned(order) {
  if (!order.driver_id) return;
  await createNotification({
    userId: order.driver_id,
    title: "تم إسناد طلب جديد إليك",
    body: `طلب رقم ${order.id?.slice(-6) || ""} بانتظار قبولك.`,
    orderId: order.id,
  });
}

// إشعار الموزع عند وصول طلب جديد
export async function notifyDistributorsNewOrder(order) {
  // لا يوجد معرف موزع محدد للطلبات الجديدة، نتركها للوحة الموزع
  // (في هذه النسخة يرى الموزعون الطلبات الجديدة مباشرة في اللوحة)
}