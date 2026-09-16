import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { recordTransaction, findOrCreateCustody, adjustCustody } from '../../shared/inventory.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "customer";
    if (role !== "admin" && role !== "driver") {
      return Response.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, action, items: returnItems, newItems, note } = body;

    if (!order_id) return Response.json({ error: "الطلب مطلوب" }, { status: 400 });
    if (!action || !["return", "exchange"].includes(action)) {
      return Response.json({ error: "الإجراء غير صالح" }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) return Response.json({ error: "الطلب غير موجود" }, { status: 400 });
    if (order.status !== "DELIVERED") {
      return Response.json({ error: "المرتجع/الاستبدال متاح فقط للطلبات المسلّمة" }, { status: 400 });
    }

    if (role === "driver" && order.driver_id !== user.id) {
      return Response.json({ error: "غير مصرح — لست السائق المسند" }, { status: 403 });
    }

    if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
      return Response.json({ error: "حدد العناصر المرتجعة" }, { status: 400 });
    }

    // ── Validate return quantities against ordered items (prevent custody inflation) ──
    const orderItemMap = {};
    for (const oi of (order.items || [])) {
      orderItemMap[oi.product_id] = (orderItemMap[oi.product_id] || 0) + (oi.quantity || 0);
    }
    for (const item of returnItems) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) continue;
      const ordered = orderItemMap[item.product_id] || 0;
      if (item.quantity > ordered) {
        return Response.json({ error: `الكمية المرتجعة تتجاوز الكمية المطلوبة` }, { status: 400 });
      }
    }

    const userLabel = user.full_name || user.email || "";
    const driverId = order.driver_id;
    let driverName = "";
    if (driverId) {
      try {
        const driver = await base44.asServiceRole.entities.User.get(driverId);
        driverName = driver?.full_name || driver?.email || "";
      } catch {}
    }

    const returnToCustody = !!driverId;

    // ── Process returns ──
    for (const item of returnItems) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) continue;

      const product = await base44.asServiceRole.entities.Product.get(item.product_id);
      if (!product) continue;

      if (returnToCustody) {
        const custody = await findOrCreateCustody(base44, driverId, driverName, "driver", product.id, product.name);
        await adjustCustody(base44, custody.id, item.quantity);
      } else {
        await base44.asServiceRole.entities.Product.update(product.id, {
          stock: (product.stock || 0) + item.quantity,
        });
      }

      await recordTransaction(base44, {
        type: "RETURN",
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        counterparty_id: returnToCustody ? driverId : null,
        counterparty_name: returnToCustody ? driverName : "",
        counterparty_role: returnToCustody ? "driver" : null,
        order_id: order.id,
        performed_by: user.id,
        performed_by_name: userLabel,
        performed_by_role: role,
        note: note?.trim() || "",
      });
    }

    // ── Process exchange (new items) ──
    if (action === "exchange" && newItems && Array.isArray(newItems)) {
      for (const item of newItems) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) continue;

        const product = await base44.asServiceRole.entities.Product.get(item.product_id);
        if (!product) {
          return Response.json({ error: "المنتج البديل غير موجود" }, { status: 400 });
        }

        if ((product.stock || 0) < item.quantity) {
          return Response.json({ error: `المخزون غير كافٍ لـ ${product.name}` }, { status: 400 });
        }

        await base44.asServiceRole.entities.Product.update(product.id, {
          stock: product.stock - item.quantity,
        });

        await recordTransaction(base44, {
          type: "EXCHANGE",
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          order_id: order.id,
          performed_by: user.id,
          performed_by_name: userLabel,
          performed_by_role: role,
          note: note?.trim() || "",
        });
      }
    }

    // ── Record in OrderHistory ──
    const returnSummary = returnItems.map(i => `${i.product_name || ""} ×${i.quantity}`).join("، ");
    const exchangeSummary = (action === "exchange" && newItems?.length > 0)
      ? " ← " + newItems.map(i => `${i.product_name || ""} ×${i.quantity}`).join("، ")
      : "";

    try {
      await base44.asServiceRole.entities.OrderHistory.create({
        order_id: order.id,
        previous_status: "DELIVERED",
        new_status: "DELIVERED",
        performed_by: user.id,
        performed_by_name: userLabel,
        performed_by_role: role,
        customer_id: order.customer_id || null,
        driver_id: order.driver_id || null,
        distributor_id: order.distributor_id || null,
        note: `${action === "exchange" ? "استبدال" : "مرتجع"}: ${returnSummary}${exchangeSummary}`,
      });
    } catch {}

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}