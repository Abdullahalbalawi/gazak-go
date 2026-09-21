import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { recordTransaction, reserveStock, releaseStock } from '../../shared/inventory.ts';

const DELIVERY_FEE = 15;
const IDEMPOTENCY_WINDOW_MS = 30_000; // 30 seconds

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "customer";
    if (role !== "customer" && role !== "admin") {
      return Response.json({ error: "Only customers can create orders" }, { status: 403 });
    }

    const body = await req.json();
    const { items, customer_name, customer_phone, address, latitude, longitude, payment_method } = body;

    // ── Validate required fields ──
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "السلة فارغة" }, { status: 400 });
    }
    if (!customer_name?.trim() || !customer_phone?.trim() || !address?.trim()) {
      return Response.json({ error: "يرجى تعبئة جميع الحقول" }, { status: 400 });
    }
    if (!payment_method || !["CASH", "CARD"].includes(payment_method)) {
      return Response.json({ error: "طريقة الدفع غير صالحة" }, { status: 400 });
    }

    // Validate items structure — only product_id and quantity accepted from frontend
    for (const item of items) {
      if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return Response.json({ error: "بيانات السلة غير صالحة" }, { status: 400 });
      }
      if (item.quantity > 99) {
        return Response.json({ error: "الكمية المطلوبة كبيرة جداً" }, { status: 400 });
      }
    }

    // ── Idempotency: check for a recent order with same items ──
    const itemsHash = items.map(i => `${i.product_id}:${i.quantity}`).sort().join("|");
    const recentOrders = await base44.asServiceRole.entities.Order.filter(
      { customer_id: user.id }, "-created_date", 5
    );
    const now = Date.now();
    for (const ro of recentOrders) {
      const createdAt = new Date(ro.created_date).getTime();
      if (now - createdAt < IDEMPOTENCY_WINDOW_MS) {
        const roHash = (ro.items || []).map(i => `${i.product_id}:${i.quantity}`).sort().join("|");
        if (roHash === itemsHash) {
          return Response.json({ order: ro, idempotent: true });
        }
      }
    }

    // ── Fetch all products from DB (prices come from DB, NOT frontend) ──
    const allProducts = await base44.asServiceRole.entities.Product.list();
    const productMap = {};
    for (const p of allProducts) productMap[p.id] = p;

    // ── Validate products and compute prices from DB only ──
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = productMap[item.product_id];
      if (!product) {
        return Response.json({ error: "المنتج غير موجود" }, { status: 400 });
      }
      if (product.status !== "ACTIVE") {
        return Response.json({ error: `المنتج "${product.name}" غير متوفر حالياً` }, { status: 400 });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
        cylinder_type: product.cylinder_type || "new",
      });
    }

    const return_count = orderItems
      .filter((i) => i.cylinder_type === "exchange")
      .reduce((sum, i) => sum + i.quantity, 0);

    const total = subtotal + DELIVERY_FEE;

    // ── Atomic stock reservation (Available → Reserved) ──
    const reserved = []; // track for rollback
    let unavailableProduct = null;
    for (const item of orderItems) {
      const r = await reserveStock(base44, item.product_id, item.quantity);
      if (!r.ok) {
        unavailableProduct = productMap[item.product_id];
        break;
      }
      reserved.push({ product_id: item.product_id, quantity: item.quantity });
    }

    // ── If any item couldn't be reserved: rollback + notify + reject ──
    if (unavailableProduct) {
      for (const r of reserved) {
        try { await releaseStock(base44, r.product_id, r.quantity); } catch {}
      }
      const pName = unavailableProduct.name || "المنتج";

      // Notify customer
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id, title: "الكمية غير متوفرة",
          body: `الكمية المطلوبة من "${pName}" غير متوفرة حالياً.`,
          order_id: null, type: "stock_unavailable", read: false,
        });
      } catch {}
      // Notify distributors
      try {
        const distributors = await base44.asServiceRole.entities.User.filter({ role: "distributor" });
        for (const d of distributors) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: d.id, title: "طلب غير متوفر",
            body: `طلب من العميل على "${pName}" لم يتم بسبب عدم توفر الكمية.`,
            order_id: null, type: "stock_unavailable_distributor", read: false,
          });
        }
      } catch {}
      // Notify admins
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
        for (const a of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: a.id, title: "نقص في المخزون",
            body: `طلب لم يتم بسبب نقص كمية "${pName}".`,
            order_id: null, type: "stock_unavailable_admin", read: false,
          });
        }
      } catch {}

      return Response.json({ error: `الكمية المطلوبة من "${pName}" غير متوفرة حالياً` }, { status: 400 });
    }

    // ── Create the order with computed values only ──
    let order;
    try {
      order = await base44.asServiceRole.entities.Order.create({
        customer_id: user.id,
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        status: "NEW",
        items: orderItems,
        subtotal,
        delivery_fee: DELIVERY_FEE,
        total,
        payment_method,
        payment_status: "PENDING",
        address: address.trim(),
        latitude: latitude || null,
        longitude: longitude || null,
        return_count,
      });
    } catch (e) {
      // Order creation failed — release reserved stock
      for (const r of reserved) {
        try { await releaseStock(base44, r.product_id, r.quantity); } catch {}
      }
      return Response.json({ error: "فشل إنشاء الطلب" }, { status: 500 });
    }

    // ── Record RESERVE transactions ──
    for (const item of orderItems) {
      try {
        await recordTransaction(base44, {
          type: "RESERVE",
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          order_id: order.id,
          performed_by: user.id,
          performed_by_name: user.full_name || user.email || "",
          performed_by_role: user.role || "customer",
          note: "",
        });
      } catch {}
    }

    // ── Create OrderHistory record for NEW ──
    try {
      await base44.asServiceRole.entities.OrderHistory.create({
        order_id: order.id,
        previous_status: null,
        new_status: "NEW",
        performed_by: user.id,
        performed_by_name: user.full_name || user.email || "",
        performed_by_role: user.role || "customer",
        customer_id: order.customer_id || null,
        driver_id: null,
        distributor_id: null,
        note: "",
      });
    } catch {}

    // ── Send "NEW" notification to all distributors ──
    try {
      const distributors = await base44.asServiceRole.entities.User.filter({ role: "distributor" });
      for (const d of distributors) {
        const existing = await base44.asServiceRole.entities.Notification.filter({
          user_id: d.id, order_id: order.id, type: "status_NEW",
        });
        if (existing.length === 0) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: d.id, title: "وصول طلب جديد", body: "لديك طلب جديد بانتظار القبول.",
            order_id: order.id, type: "status_NEW", read: false,
          });
        }
      }
    } catch {}

    // ── Send "NEW" admin alert ──
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
      for (const a of admins) {
        const existing = await base44.asServiceRole.entities.Notification.filter({
          user_id: a.id, order_id: order.id, type: "status_NEW_admin",
        });
        if (existing.length === 0) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: a.id, title: "طلب جديد بانتظار القبول", body: "طلب جديد يحتاج إلى مراجعة.",
            order_id: order.id, type: "status_NEW_admin", read: false,
          });
        }
      }
    } catch {}

    // ── Send "تم استلام طلبك" notification to customer ──
    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, title: "تم استلام طلبك", body: "وصل طلبك إلينا وجاري معالجته.",
        order_id: order.id, type: "order_created", read: false,
      });
    } catch {}

    return Response.json({ order });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}