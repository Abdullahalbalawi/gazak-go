import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkOrderAvailability, handleStatusInventory } from '../../shared/inventory.ts';

const ORDER_STATUSES = [
  "NEW", "ACCEPTED", "PREPARING", "READY", "ASSIGNED",
  "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "CANCELLED"
];

const TRANSITIONS = {
  accept:        { from: "NEW",                 to: "ACCEPTED",         roles: ["distributor", "admin"] },
  prepare:       { from: "ACCEPTED",            to: "PREPARING",        roles: ["distributor", "admin"] },
  ready:         { from: "PREPARING",           to: "READY",            roles: ["distributor", "admin"] },
  assign:        { from: "READY",               to: "ASSIGNED",         roles: ["admin"] },
  startDelivery: { from: "ASSIGNED",            to: "OUT_FOR_DELIVERY", roles: ["driver", "admin"] },
  arrive:        { from: "OUT_FOR_DELIVERY",    to: "ARRIVED",           roles: ["driver", "admin"] },
  deliver:       { from: "ARRIVED",             to: "DELIVERED",        roles: ["driver", "admin"] },
  cancel:        { from: ["NEW","ACCEPTED","PREPARING"], to: "CANCELLED", roles: ["customer", "admin"] },
};

// Notification routing per status → recipient + message
const NOTIFICATION_ROUTING = {
  ACCEPTED:         { recipient: "customer",    title: "تم قبول طلبك",      body: "بدأ الموزع في تجهيز طلبك." },
  PREPARING:        { recipient: "customer",    title: "طلبك قيد التجهيز",  body: "جاري تجهيز أسطواناتك الآن." },
  READY:            { recipient: "customer",    title: "طلبك جاهز للتوصيل", body: "تم تجهيز طلبك وجاري إسناده للسائق." },
  OUT_FOR_DELIVERY: { recipient: "customer",    title: "طلبك خرج للتوصيل",  body: "السائق في طريقه إليك." },
  ARRIVED:          { recipient: "customer",    title: "وصل السائق",        body: "وصل السائق إلى موقعك، يرجى الاستلام." },
  DELIVERED:        { recipient: "customer",    title: "تم التسليم",        body: "تم تسليم طلبك بنجاح. شكراً لك!" },
  CANCELLED:        { recipient: "customer",    title: "تم إلغاء الطلب",    body: "تم إلغاء طلبك." },
};

// Multi-recipient notifications
const ASSIGNED_NOTIFICATIONS = [
  { recipient: "driver",   title: "تم إسناد طلب جديد إليك", body: "طلب بانتظار قبولك وبدء التوصيل." },
  { recipient: "customer", title: "تم تعيين سائق",          body: "تم تعيين سائق لطلبك، سيتواصل معك قريباً." },
];

const CANCELLED_DISTRIBUTOR_NOTIFICATION = {
  recipient: "distributor", title: "تم إلغاء طلب", body: "تم إلغاء طلب كان مرتبطاً بك.",
};

function checkTransition(action, currentStatus, role) {
  const t = TRANSITIONS[action];
  if (!t) return null;
  if (!t.roles.includes(role)) return null;
  if (Array.isArray(t.from)) {
    if (!t.from.includes(currentStatus)) return null;
  } else {
    if (t.from !== currentStatus) return null;
  }
  return t;
}

// ── Idempotent notification: skip if already exists for order + type + user ──
async function sendNotification(base44, userId, type, title, body, orderId) {
  if (!userId) return;
  try {
    const existing = await base44.asServiceRole.entities.Notification.filter({
      user_id: userId,
      order_id: orderId,
      type: type,
    });
    if (existing.length > 0) return; // already sent — idempotent
    await base44.asServiceRole.entities.Notification.create({
      user_id: userId,
      title,
      body: body || "",
      order_id: orderId,
      type,
      read: false,
    });
  } catch (e) {
    // non-critical
  }
}

// ── Send notification to all admins (admin alert) — idempotent per admin ──
async function sendAdminNotifications(base44, type, title, body, orderId) {
  try {
    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
    for (const a of admins) {
      await sendNotification(base44, a.id, type, title, body, orderId);
    }
  } catch (e) {
    // non-critical
  }
}

// ── Create OrderHistory record (idempotent: skip if already exists) ──
async function createHistoryRecord(base44, order, previousStatus, newStatus, user, note) {
  try {
    const existing = await base44.asServiceRole.entities.OrderHistory.filter({
      order_id: order.id,
      new_status: newStatus,
    });
    if (existing.length > 0) return; // already logged — idempotent
    await base44.asServiceRole.entities.OrderHistory.create({
      order_id: order.id,
      previous_status: previousStatus || null,
      new_status: newStatus,
      performed_by: user.id,
      performed_by_name: user.full_name || user.email || "",
      performed_by_role: user.role || "customer",
      customer_id: order.customer_id || null,
      driver_id: order.driver_id || null,
      distributor_id: order.distributor_id || null,
      note: note || "",
    });
  } catch (e) {
    // non-critical
  }
}

// ── Check if driver has an active delivery (ASSIGNED/OUT_FOR_DELIVERY/ARRIVED) ──
async function checkDriverBusy(base44, driverId, excludeOrderId = null) {
  const driverOrders = await base44.asServiceRole.entities.Order.filter(
    { driver_id: driverId }, "-created_date", 100
  );
  const activeStatuses = ["ASSIGNED", "OUT_FOR_DELIVERY", "ARRIVED"];
  return driverOrders.find(o =>
    activeStatuses.includes(o.status) && o.id !== excludeOrderId
  );
}

// ── Send all notifications for a status transition ──
async function sendStatusNotifications(base44, order, newStatus) {
  const type = `status_${newStatus}`;

  // Single-recipient notifications
  const routing = NOTIFICATION_ROUTING[newStatus];
  if (routing) {
    let userId = null;
    if (routing.recipient === "customer") userId = order.customer_id;
    else if (routing.recipient === "driver") userId = order.driver_id;
    else if (routing.recipient === "distributor") userId = order.distributor_id;
    await sendNotification(base44, userId, type, routing.title, routing.body, order.id);
  }

  // Multi-recipient: ASSIGNED → driver + customer
  if (newStatus === "ASSIGNED") {
    for (const n of ASSIGNED_NOTIFICATIONS) {
      let userId = null;
      if (n.recipient === "customer") userId = order.customer_id;
      else if (n.recipient === "driver") userId = order.driver_id;
      await sendNotification(base44, userId, `${type}_${n.recipient}`, n.title, n.body, order.id);
    }
  }

  // CANCELLED → notify distributor (if reached) + driver (if assigned) + admin alert
  if (newStatus === "CANCELLED") {
    if (order.distributor_id) {
      const dn = CANCELLED_DISTRIBUTOR_NOTIFICATION;
      await sendNotification(base44, order.distributor_id, `${type}_distributor`, dn.title, dn.body, order.id);
    }
    if (order.driver_id) {
      await sendNotification(base44, order.driver_id, `${type}_driver`, "تم إلغاء طلب", "تم إلغاء طلب كان مسنداً إليك.", order.id);
    }
    await sendAdminNotifications(base44, `${type}_admin`, "تم إلغاء طلب", "تم إلغاء طلب في النظام.", order.id);
  }

  // READY → admin alert (جاهز للتعيين)
  if (newStatus === "READY") {
    await sendAdminNotifications(base44, `${type}_admin`, "طلب جاهز للتعيين", "هناك طلب جاهز بانتظار تعيين سائق.", order.id);
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { order_id, action, extra = {} } = body;

    if (!order_id || !action) {
      return Response.json({ error: "Missing order_id or action" }, { status: 400 });
    }

    const role = user.role || "customer";

    // ── Admin manual status override ──
    if (action === "manualStatus") {
      if (role !== "admin") {
        return Response.json({ error: "Admin only" }, { status: 403 });
      }
      const newStatus = extra.status;
      if (!ORDER_STATUSES.includes(newStatus)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }
      let order;
      try {
        order = await base44.entities.Order.get(order_id);
      } catch {
        return Response.json({ error: "Order not found" }, { status: 404 });
      }

      // Idempotent: if already in target status, return success
      if (order.status === newStatus) {
        return Response.json({ order, idempotent: true });
      }

      const previousStatus = order.status;
      const updated = await base44.asServiceRole.entities.Order.update(order_id, { status: newStatus });

      // Create history record + send notifications
      await createHistoryRecord(base44, updated, previousStatus, newStatus, user, extra.reason);
      await sendStatusNotifications(base44, updated, newStatus);

      // Inventory side-effects (consume on DELIVERED, release on CANCELLED)
      await handleStatusInventory(base44, updated, newStatus, user);

      return Response.json({ order: updated });
    }

    // ── Admin manual driver reassignment (Manual Override) ──
    if (action === "reassign") {
      if (role !== "admin") {
        return Response.json({ error: "Admin only" }, { status: 403 });
      }
      if (!extra.driver_id) {
        return Response.json({ error: "Driver ID required" }, { status: 400 });
      }
      let order;
      try {
        order = await base44.entities.Order.get(order_id);
      } catch {
        return Response.json({ error: "Order not found" }, { status: 404 });
      }
      // Rule 4: only allow reassign for orders in active delivery states (not yet delivered/cancelled)
      const reassignable = ["ASSIGNED", "OUT_FOR_DELIVERY", "ARRIVED"];
      if (!reassignable.includes(order.status)) {
        return Response.json({ error: "لا يمكن إعادة تعيين طلب بهذه الحالة" }, { status: 400 });
      }
      // Rule 1: verify new driver exists and has role "driver"
      let driver;
      try {
        driver = await base44.asServiceRole.entities.User.get(extra.driver_id);
      } catch {
        return Response.json({ error: "السائق المحدد غير موجود" }, { status: 400 });
      }
      if (!driver || driver.role !== "driver") {
        return Response.json({ error: "المستخدم المحدد ليس سائقاً" }, { status: 400 });
      }
      // Rule 2: new driver must not be busy (exclude this order from the check)
      const busyOrder = await checkDriverBusy(base44, extra.driver_id, order.id);
      if (busyOrder) {
        return Response.json({ error: "السائق مشغول بطلب توصيل نشط" }, { status: 400 });
      }
      // Same driver — no-op
      if (order.driver_id === extra.driver_id) {
        return Response.json({ order, idempotent: true });
      }

      const updated = await base44.asServiceRole.entities.Order.update(order_id, { driver_id: extra.driver_id });

      // Manual Override history record (always log — bypass idempotency)
      try {
        await base44.asServiceRole.entities.OrderHistory.create({
          order_id: order.id,
          previous_status: order.status,
          new_status: order.status,
          performed_by: user.id,
          performed_by_name: user.full_name || user.email || "",
          performed_by_role: user.role || "admin",
          customer_id: order.customer_id || null,
          driver_id: extra.driver_id,
          distributor_id: order.distributor_id || null,
          note: `Manual Override: إعادة تعيين السائق إلى ${driver.full_name || driver.email}`,
        });
      } catch (e) {
        // non-critical
      }

      // Notify new driver + customer
      await sendNotification(base44, extra.driver_id, `reassign_driver_${order.id}_${extra.driver_id}`, "تم إسناد طلب إليك", "تم إسناد طلب جديد إليك بعد إعادة التعيين.", order.id);
      await sendNotification(base44, order.customer_id, `reassign_customer_${order.id}_${extra.driver_id}`, "تم تغيير السائق", "تم تغيير السائق المسؤول عن طلبك.", order.id);

      return Response.json({ order: updated });
    }

    // ── Admin delete order (releases reserved stock, then removes order) ──
    if (action === "delete") {
      if (role !== "admin") {
        return Response.json({ error: "Admin only" }, { status: 403 });
      }
      let order;
      try {
        order = await base44.entities.Order.get(order_id);
      } catch {
        return Response.json({ error: "Order not found" }, { status: 404 });
      }
      // Release reserved stock if order not yet delivered/cancelled
      if (order.status !== "DELIVERED" && order.status !== "CANCELLED") {
        await handleStatusInventory(base44, order, "CANCELLED", user);
      }
      // Delete order
      await base44.asServiceRole.entities.Order.delete(order_id);
      // Clean up order history
      try {
        const hist = await base44.asServiceRole.entities.OrderHistory.filter({ order_id });
        for (const h of hist) {
          await base44.asServiceRole.entities.OrderHistory.delete(h.id);
        }
      } catch {}
      return Response.json({ success: true });
    }

    // ── Standard transitions ──
    let order;
    try {
      order = await base44.entities.Order.get(order_id);
    } catch {
      return Response.json({ error: "Order not found or access denied" }, { status: 404 });
    }

    // Rule 4: assign is only for unassigned READY orders — reject if already has a driver (before idempotency)
    if (action === "assign" && order.driver_id) {
      return Response.json({ error: "هذا الطلب مسند لسائق بالفعل" }, { status: 400 });
    }

    // Idempotent: if already in target status, return success
    const targetStatus = TRANSITIONS[action]?.to;
    if (targetStatus && order.status === targetStatus) {
      return Response.json({ order, idempotent: true });
    }

    const t = checkTransition(action, order.status, role);
    if (!t) {
      return Response.json({ error: "Transition not allowed for this role/status" }, { status: 403 });
    }

    // Ownership checks — use customer_id (set by createOrder), not created_by_id (which is the service role)
    if (role === "customer" && order.customer_id !== user.id) {
      return Response.json({ error: "Not your order" }, { status: 403 });
    }
    if (role === "driver" && order.driver_id !== user.id) {
      return Response.json({ error: "Order not assigned to you" }, { status: 403 });
    }
    if (role === "distributor" && order.distributor_id !== user.id && order.status !== "NEW") {
      return Response.json({ error: "Order not assigned to you" }, { status: 403 });
    }

    // Build update — only allowed fields
    const update = { status: t.to };
    if (action === "accept") {
      // Defensive: verify stock still reserved for this order before assigning distributor
      const avail = await checkOrderAvailability(base44, order);
      if (!avail.ok) {
        return Response.json({ error: "المخزون غير متوفر لهذا الطلب" }, { status: 400 });
      }
      update.distributor_id = user.id;
    }
    if (action === "assign") {
      if (!extra.driver_id) {
        return Response.json({ error: "Driver ID required" }, { status: 400 });
      }
      // Rule 4: order must not already have a driver
      if (order.driver_id) {
        return Response.json({ error: "هذا الطلب مسند لسائق بالفعل" }, { status: 400 });
      }
      // Rule 1: verify the driver exists and has role "driver"
      let driver;
      try {
        driver = await base44.asServiceRole.entities.User.get(extra.driver_id);
      } catch {
        return Response.json({ error: "السائق المحدد غير موجود" }, { status: 400 });
      }
      if (!driver || driver.role !== "driver") {
        return Response.json({ error: "المستخدم المحدد ليس سائقاً" }, { status: 400 });
      }
      // Rule 2: Smart Dispatch — driver must not have an active delivery
      const busyOrder = await checkDriverBusy(base44, extra.driver_id, order.id);
      if (busyOrder) {
        return Response.json({ error: "السائق مشغول بطلب توصيل نشط" }, { status: 400 });
      }
      // Defensive: verify stock still reserved for this order before assigning driver
      const availAssign = await checkOrderAvailability(base44, order);
      if (!availAssign.ok) {
        return Response.json({ error: "المخزون غير متوفر لهذا الطلب" }, { status: 400 });
      }
      update.driver_id = extra.driver_id;
    }

    const previousStatus = order.status;
    const updated = await base44.asServiceRole.entities.Order.update(order_id, update);

    // Create history record + send notifications
    await createHistoryRecord(base44, updated, previousStatus, t.to, user, extra.reason);
    await sendStatusNotifications(base44, updated, t.to);

    // Inventory side-effects (consume on DELIVERED, release on CANCELLED)
    await handleStatusInventory(base44, updated, t.to, user);

    return Response.json({ order: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}