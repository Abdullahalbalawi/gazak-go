export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const DEMO_USER = {
  id: "demo-customer-001",
  email: "demo@gazak-go.local",
  phone: "0500000000",
  full_name: "عميل تجريبي",
  role: "customer",
};

export const DEMO_PRODUCTS = [
  { id: "demo-gas-11", name: "أسطوانة غاز 11 كجم", price: 25, stock: 20, cylinder_type: "new", description: "أسطوانة غاز للاستخدام المنزلي" },
  { id: "demo-gas-22", name: "أسطوانة غاز 22 كجم", price: 45, stock: 12, cylinder_type: "new", description: "حجم أكبر للاستخدام المنزلي" },
  { id: "demo-exchange-11", name: "استبدال أسطوانة 11 كجم", price: 20, stock: 30, cylinder_type: "exchange", description: "استبدال الأسطوانة الفارغة بأخرى ممتلئة" },
];

const ORDERS_KEY = "gazak_demo_orders";

export function getDemoOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch { return []; }
}

export function getDemoOrder(id) {
  return getDemoOrders().find((order) => order.id === id) || null;
}

export function createDemoOrder({ name, phone, address, latitude, longitude, paymentMethod, items, deliveryFee = 15 }) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const order = {
    id: `DEMO-${Date.now()}`,
    customer_id: DEMO_USER.id,
    customer_name: name,
    customer_phone: phone,
    address,
    latitude,
    longitude,
    payment_method: paymentMethod,
    status: "NEW",
    subtotal,
    delivery_fee: deliveryFee,
    total: subtotal + deliveryFee,
    created_at: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
  };
  localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...getDemoOrders()]));
  return order;
}

export function cancelDemoOrder(id) {
  const orders = getDemoOrders().map((order) => order.id === id ? { ...order, status: "CANCELLED" } : order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return getDemoOrder(id);
}
