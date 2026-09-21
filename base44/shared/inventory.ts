// base44/shared/inventory.ts
// منطق مشترك لإدارة المخزون والعهدة — يستخدم في الدوال الخلفية فقط

export async function recordTransaction(base44, data) {
  const {
    type, product_id, product_name, quantity,
    counterparty_id, counterparty_name, counterparty_role,
    order_id, performed_by, performed_by_name, performed_by_role,
    note,
  } = data;

  return await base44.asServiceRole.entities.CylinderTransaction.create({
    type,
    product_id,
    product_name: product_name || "",
    quantity,
    counterparty_id: counterparty_id || null,
    counterparty_name: counterparty_name || "",
    counterparty_role: counterparty_role || null,
    order_id: order_id || null,
    performed_by: performed_by || null,
    performed_by_name: performed_by_name || "",
    performed_by_role: performed_by_role || "",
    note: note || "",
  });
}

export async function findOrCreateCustody(base44, userId, userName, userRole, productId, productName) {
  const existing = await base44.asServiceRole.entities.Custody.filter({
    user_id: userId,
    product_id: productId,
  });
  if (existing.length > 0) {
    return existing[0];
  }
  return await base44.asServiceRole.entities.Custody.create({
    user_id: userId,
    user_name: userName || "",
    user_role: userRole,
    product_id: productId,
    product_name: productName || "",
    quantity: 0,
  });
}

export async function adjustCustody(base44, custodyId, delta) {
  const custody = await base44.asServiceRole.entities.Custody.get(custodyId);
  const newQty = (custody.quantity || 0) + delta;
  if (newQty < 0) {
    throw new Error("كمية العهدة غير كافية");
  }
  return await base44.asServiceRole.entities.Custody.update(custodyId, { quantity: newQty });
}

// ── Atomic stock reservation (Available → Reserved) ──
// Returns { ok: true } if reserved, { ok: false } if insufficient (race-safe)
export async function reserveStock(base44, productId, qty) {
  const res = await base44.asServiceRole.entities.Product.updateMany(
    { id: productId, stock: { $gte: qty } },
    { $inc: { stock: -qty, reserved_stock: qty } }
  );
  if (res && res.updated === 1) return { ok: true };
  return { ok: false };
}

// ── Release reserved back to available (on cancel before delivery) ──
export async function releaseStock(base44, productId, qty) {
  await base44.asServiceRole.entities.Product.updateMany(
    { id: productId, reserved_stock: { $gte: qty } },
    { $inc: { reserved_stock: -qty, stock: qty } }
  );
}

// ── Consume reserved → sold (on delivery) ──
export async function consumeStock(base44, productId, qty) {
  await base44.asServiceRole.entities.Product.updateMany(
    { id: productId, reserved_stock: { $gte: qty } },
    { $inc: { reserved_stock: -qty, sold_stock: qty } }
  );
}

// ── Verify order items are still covered by reserved stock (defensive) ──
export async function checkOrderAvailability(base44, order) {
  const items = order.items || [];
  for (const item of items) {
    const p = await base44.asServiceRole.entities.Product.get(item.product_id);
    if ((p.reserved_stock || 0) < (item.quantity || 0)) {
      return { ok: false, product: p, item };
    }
  }
  return { ok: true };
}

// ── Stock side-effects of a status transition (consume on DELIVERED, release on CANCELLED) ──
export async function handleStatusInventory(base44, order, newStatus, user) {
  if (newStatus === "DELIVERED") {
    for (const item of (order.items || [])) {
      try { await consumeStock(base44, item.product_id, item.quantity); } catch {}
      try {
        await recordTransaction(base44, {
          type: "SALE", product_id: item.product_id, product_name: item.product_name,
          quantity: item.quantity, order_id: order.id,
          performed_by: user.id, performed_by_name: user.full_name || user.email || "",
          performed_by_role: user.role || "customer", note: "",
        });
      } catch {}
    }
  } else if (newStatus === "CANCELLED") {
    for (const item of (order.items || [])) {
      try { await releaseStock(base44, item.product_id, item.quantity); } catch {}
      try {
        await recordTransaction(base44, {
          type: "RELEASE", product_id: item.product_id, product_name: item.product_name,
          quantity: item.quantity, order_id: order.id,
          performed_by: user.id, performed_by_name: user.full_name || user.email || "",
          performed_by_role: user.role || "customer", note: "",
        });
      } catch {}
    }
  }
}