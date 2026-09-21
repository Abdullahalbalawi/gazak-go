// حالات الطلب وانتقالاتها وأذونات الأدوار

export const ORDER_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "CANCELLED",
  "OUT_OF_STOCK",
  "WAITING_STOCK",
];

export const STATUS_LABELS_AR = {
  NEW: "جديد",
  ACCEPTED: "مقبول",
  PREPARING: "قيد التجهيز",
  READY: "جاهز",
  ASSIGNED: "مسند",
  OUT_FOR_DELIVERY: "خرج للتوصيل",
  ARRIVED: "وصل السائق",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
  OUT_OF_STOCK: "غير متوفر",
  WAITING_STOCK: "بانتظار المخزون",
};

export const CANCELLABLE_STATUSES = ["NEW", "ACCEPTED", "PREPARING"];

// انتقالات الحالة: من ← إلى، والأدوار المسموح لها
export const TRANSITIONS = {
  accept:        { from: "NEW",      to: "ACCEPTED",         roles: ["distributor", "admin"] },
  prepare:      { from: "ACCEPTED", to: "PREPARING",        roles: ["distributor", "admin"] },
  ready:        { from: "PREPARING", to: "READY",            roles: ["distributor", "admin"] },
  assign:       { from: "READY",    to: "ASSIGNED",         roles: ["admin"] },
  startDelivery:{ from: "ASSIGNED", to: "OUT_FOR_DELIVERY", roles: ["driver", "admin"] },
  arrive:       { from: "OUT_FOR_DELIVERY", to: "ARRIVED",   roles: ["driver", "admin"] },
  deliver:      { from: "ARRIVED",  to: "DELIVERED",         roles: ["driver", "admin"] },
  cancel:       { from: CANCELLABLE_STATUSES, to: "CANCELLED", roles: ["customer", "admin"] },
};

// نصوص إشعارات العميل عند تغير الحالة
export const CUSTOMER_NOTIFICATIONS = {
  NEW: { title: "تم استلام طلبك", body: "وصل طلبك إلينا وجاري معالجته." },
  ACCEPTED: { title: "تم قبول طلبك", body: "بدأ الموزع في تجهيز طلبك." },
  PREPARING: { title: "طلبك قيد التجهيز", body: "جاري تجهيز أسطواناتك الآن." },
  OUT_FOR_DELIVERY: { title: "طلبك خرج للتوصيل", body: "السائق في طريقه إليك." },
  ARRIVED: { title: "وصل السائق", body: "وصل السائق إلى موقعك، يرجى الاستلام." },
  DELIVERED: { title: "تم التسليم", body: "تم تسليم طلبك بنجاح. شكراً لك!" },
  CANCELLED: { title: "تم إلغاء الطلب", body: "تم إلغاء طلبك." },
};

export function canTransition(action, currentStatus, role) {
  const t = TRANSITIONS[action];
  if (!t) return false;
  if (!t.roles.includes(role)) return false;
  if (Array.isArray(t.from)) return t.from.includes(currentStatus);
  return t.from === currentStatus;
}

export function canCancel(status, role) {
  return CANCELLABLE_STATUSES.includes(status) && ["customer", "admin"].includes(role);
}

export function getStatusLabel(status) {
  return STATUS_LABELS_AR[status] || status;
}

// ألوان شارة الحالة
export const STATUS_BADGE_STYLES = {
  NEW: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-indigo-100 text-indigo-700",
  PREPARING: "bg-amber-100 text-amber-700",
  READY: "bg-cyan-100 text-cyan-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  ARRIVED: "bg-teal-100 text-teal-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  OUT_OF_STOCK: "bg-red-100 text-red-700",
  WAITING_STOCK: "bg-yellow-100 text-yellow-700",
};