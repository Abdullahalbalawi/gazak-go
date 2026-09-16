import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { recordTransaction, findOrCreateCustody, adjustCustody } from '../../shared/inventory.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "customer";
    const body = await req.json();
    const { action, product_id, quantity, counterparty_id, note, delta } = body;

    if (!product_id) return Response.json({ error: "المنتج مطلوب" }, { status: 400 });
    const product = await base44.asServiceRole.entities.Product.get(product_id);
    if (!product) return Response.json({ error: "المنتج غير موجود" }, { status: 400 });

    const userLabel = user.full_name || user.email || "";

    // ── RESTOCK: admin only ──
    if (action === "restock") {
      if (role !== "admin") return Response.json({ error: "الإدارة فقط يمكنها التزويد" }, { status: 403 });
      if (!note?.trim()) return Response.json({ error: "السبب إلزامي للتزويد" }, { status: 400 });
      if (!quantity || quantity <= 0) return Response.json({ error: "الكمية غير صالحة" }, { status: 400 });

      const newStock = (product.stock || 0) + quantity;
      await base44.asServiceRole.entities.Product.update(product_id, { stock: newStock });

      await recordTransaction(base44, {
        type: "RESTOCK",
        product_id: product.id,
        product_name: product.name,
        quantity,
        performed_by: user.id,
        performed_by_name: userLabel,
        performed_by_role: role,
        note: note.trim(),
      });

      return Response.json({ success: true, stock: newStock });
    }

    // ── ADJUSTMENT: admin only ──
    if (action === "adjust") {
      if (role !== "admin") return Response.json({ error: "الإدارة فقط يمكنها التسوية" }, { status: 403 });
      if (!note?.trim()) return Response.json({ error: "السبب إلزامي للتسوية" }, { status: 400 });
      if (delta === undefined || delta === null || delta === 0) {
        return Response.json({ error: "قيمة التسوية غير صالحة" }, { status: 400 });
      }

      const newStock = (product.stock || 0) + delta;
      if (newStock < 0) return Response.json({ error: "المخزون لا يمكن أن يكون سالباً" }, { status: 400 });

      await base44.asServiceRole.entities.Product.update(product_id, { stock: newStock });

      await recordTransaction(base44, {
        type: "ADJUSTMENT",
        product_id: product.id,
        product_name: product.name,
        quantity: delta,
        performed_by: user.id,
        performed_by_name: userLabel,
        performed_by_role: role,
        note: note.trim(),
      });

      return Response.json({ success: true, stock: newStock });
    }

    // ── TRANSFER TO DISTRIBUTOR: admin only ──
    if (action === "transferToDistributor") {
      if (role !== "admin") return Response.json({ error: "الإدارة فقط يمكنها التحويل" }, { status: 403 });
      if (!quantity || quantity <= 0) return Response.json({ error: "الكمية غير صالحة" }, { status: 400 });
      if (!counterparty_id) return Response.json({ error: "الموزع مطلوب" }, { status: 400 });

      const distributor = await base44.asServiceRole.entities.User.get(counterparty_id);
      if (!distributor || distributor.role !== "distributor") {
        return Response.json({ error: "الموزع غير موجود" }, { status: 400 });
      }

      if ((product.stock || 0) < quantity) {
        return Response.json({ error: "المخزون الرئيسي غير كافٍ" }, { status: 400 });
      }

      // Atomic decrease (negative protection)
      const dec = await base44.asServiceRole.entities.Product.updateMany(
        { id: product_id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } }
      );
      if (!dec || dec.updated !== 1) {
        return Response.json({ error: "المخزون الرئيسي غير كافٍ" }, { status: 400 });
      }

      // Increase distributor custody
      const distName = distributor.full_name || distributor.email || "";
      const custody = await findOrCreateCustody(base44, distributor.id, distName, "distributor", product.id, product.name);
      await adjustCustody(base44, custody.id, quantity);

      await recordTransaction(base44, {
        type: "TRANSFER_DISTRIBUTOR",
        product_id: product.id,
        product_name: product.name,
        quantity,
        counterparty_id: distributor.id,
        counterparty_name: distName,
        counterparty_role: "distributor",
        performed_by: user.id,
        performed_by_name: userLabel,
        performed_by_role: role,
        note: note?.trim() || "",
      });

      return Response.json({ success: true });
    }

    // ── TRANSFER TO DRIVER: admin or distributor ──
    if (action === "transferToDriver") {
      if (role !== "admin" && role !== "distributor") {
        return Response.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (!quantity || quantity <= 0) return Response.json({ error: "الكمية غير صالحة" }, { status: 400 });
      if (!counterparty_id) return Response.json({ error: "السائق مطلوب" }, { status: 400 });

      const driver = await base44.asServiceRole.entities.User.get(counterparty_id);
      if (!driver || driver.role !== "driver") {
        return Response.json({ error: "السائق غير موجود" }, { status: 400 });
      }
      const driverName = driver.full_name || driver.email || "";

      if (role === "admin") {
        // From main stock
        if ((product.stock || 0) < quantity) {
          return Response.json({ error: "المخزون الرئيسي غير كافٍ" }, { status: 400 });
        }
        // Atomic decrease (negative protection)
        const dec = await base44.asServiceRole.entities.Product.updateMany(
          { id: product_id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } }
        );
        if (!dec || dec.updated !== 1) {
          return Response.json({ error: "المخزون الرئيسي غير كافٍ" }, { status: 400 });
        }
      } else {
        // Distributor: from own custody
        const myCustody = await base44.asServiceRole.entities.Custody.filter({
          user_id: user.id,
          product_id: product.id,
        });
        if (myCustody.length === 0 || (myCustody[0].quantity || 0) < quantity) {
          return Response.json({ error: "عهدتك غير كافية" }, { status: 400 });
        }
        await adjustCustody(base44, myCustody[0].id, -quantity);
      }

      // Increase driver custody
      const driverCustody = await findOrCreateCustody(base44, driver.id, driverName, "driver", product.id, product.name);
      await adjustCustody(base44, driverCustody.id, quantity);

      await recordTransaction(base44, {
        type: "TRANSFER_DRIVER",
        product_id: product.id,
        product_name: product.name,
        quantity,
        counterparty_id: driver.id,
        counterparty_name: driverName,
        counterparty_role: "driver",
        performed_by: user.id,
        performed_by_name: userLabel,
        performed_by_role: role,
        note: note?.trim() || "",
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}