import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { order_id, customer_id } = await req.json();
    if (!order_id || !customer_id) {
      return Response.json({ error: "Missing order_id or customer_id" }, { status: 400 });
    }

    // Only the order creator can trigger this notification
    if (customer_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the order exists and belongs to the user (prevents IDOR)
    let order;
    try {
      order = await base44.asServiceRole.entities.Order.get(order_id);
    } catch {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.customer_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotent: skip if notification already exists for this order + type + user
    const existing = await base44.asServiceRole.entities.Notification.filter({
      user_id: user.id,
      order_id: order_id,
      type: "order_created",
    });
    if (existing.length > 0) {
      return Response.json({ ok: true, idempotent: true });
    }

    try {
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        title: "تم استلام طلبك",
        body: "وصل طلبك إلينا وجاري معالجته.",
        order_id: order_id,
        type: "order_created",
        read: false,
      });
    } catch (e) {
      // non-critical
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}