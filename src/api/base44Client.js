import { supabase } from "@/lib/supabaseClient";

/**
 * Temporary compatibility facade while the UI is being migrated from Base44.
 * The application keeps the old "base44.entities.*" call sites for now, but all
 * reads/writes below are executed against Supabase.
 */

const sortSpec = (sort) => {
  const value = sort || "-created_date";
  return {
    column: value.replace(/^-/, "").replace("created_date", "created_at").replace("updated_date", "updated_at"),
    ascending: !value.startsWith("-"),
  };
};

const applyFilters = (query, filter = {}) => {
  let q = query;
  for (const [key, value] of Object.entries(filter || {})) {
    if (value === undefined || value === null || value === "") continue;
    const column = {
      created_date: "created_at",
      updated_date: "updated_at",
      active: "is_active",
    }[key] || key;

    if (Array.isArray(value)) q = q.in(column, value);
    else if (typeof value === "object" && value !== null && value.$in) q = q.in(column, value.$in);
    else q = q.eq(column, value);
  }
  return q;
};

const normalizeProduct = (row) => row && ({
  ...row,
  status: row.is_active ? "ACTIVE" : "INACTIVE",
  image: row.image_url || null,
  cylinder_type: row.metadata?.cylinder_type || "new",
  low_stock_threshold: row.metadata?.low_stock_threshold ?? 10,
  created_date: row.created_at,
  updated_date: row.updated_at,
});

const normalizeProfile = (row) => row && ({
  ...row,
  active: row.is_active,
  created_date: row.created_at,
  updated_date: row.updated_at,
});

const normalizeNotification = (row) => row && ({
  ...row,
  body: row.message,
  read: row.is_read,
  created_date: row.created_at,
  updated_date: row.created_at,
});

const normalizeTransaction = (row) => row && ({
  ...row,
  created_date: row.created_at,
  transaction_type: row.transaction_type,
});

const normalizeCustody = (row) => row && ({
  ...row,
  user_id: row.party_id,
  user_name: row.party?.full_name || "",
  user_role: row.party?.role || row.party_type?.toLowerCase() || "",
  product_name: row.product?.name || "",
  created_date: row.created_at,
  updated_date: row.updated_at,
});

async function getOrderItems(orderId) {
  const { data, error } = await supabase
    .from("order_items")
    .select("*, product:products(id,name,image_url,metadata)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((item) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name || "",
    quantity: item.quantity,
    price: Number(item.unit_price),
    total: Number(item.line_total),
    returned_quantity: item.returned_quantity || 0,
    image: item.product?.image_url || null,
    cylinder_type: item.product?.metadata?.cylinder_type || "new",
    created_date: item.created_at,
  }));
}

async function hydrateOrder(row) {
  if (!row) return null;

  const [customer, distributor, driver, items] = await Promise.all([
    row.customer_id
      ? supabase.from("profiles").select("id,full_name,phone,email,role").eq("id", row.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.distributor_id
      ? supabase.from("profiles").select("id,full_name,phone,email,role").eq("id", row.distributor_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.driver_id
      ? supabase.from("profiles").select("id,full_name,phone,email,role").eq("id", row.driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getOrderItems(row.id),
  ]);

  if (customer.error) throw customer.error;
  if (distributor.error) throw distributor.error;
  if (driver.error) throw driver.error;

  return {
    ...row,
    customer_name: row.metadata?.customer_name || customer.data?.full_name || "",
    customer_phone: row.metadata?.customer_phone || customer.data?.phone || "",
    payment_method: row.metadata?.payment_method || "CASH",
    address: row.delivery_address?.address || "",
    items,
    return_count: items.reduce((sum, item) => sum + (item.returned_quantity || 0), 0),
    created_date: row.created_at,
    updated_date: row.updated_at,
    distributor_name: distributor.data?.full_name || "",
    driver_name: driver.data?.full_name || "",
  };
}

const orderEntity = {
  async get(id) {
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error) throw error;
    return hydrateOrder(data);
  },

  async list(sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order(spec.column, { ascending: spec.ascending })
      .limit(limit);
    if (error) throw error;
    return Promise.all((data || []).map(hydrateOrder));
  },

  async filter(filter = {}, sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    let q = applyFilters(
      supabase.from("orders").select("*"),
      filter
    );
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return Promise.all((data || []).map(hydrateOrder));
  },

  async update(id, patch) {
    const dbPatch = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.customer_id) dbPatch.customer_id = patch.customer_id;
    if (patch.distributor_id !== undefined) dbPatch.distributor_id = patch.distributor_id;
    if (patch.driver_id !== undefined) dbPatch.driver_id = patch.driver_id;
    if (patch.subtotal !== undefined) dbPatch.subtotal = patch.subtotal;
    if (patch.delivery_fee !== undefined) dbPatch.delivery_fee = patch.delivery_fee;
    if (patch.discount !== undefined) dbPatch.discount = patch.discount;
    if (patch.total !== undefined) dbPatch.total = patch.total;
    if (patch.latitude !== undefined) dbPatch.latitude = patch.latitude;
    if (patch.longitude !== undefined) dbPatch.longitude = patch.longitude;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    if (patch.metadata !== undefined) dbPatch.metadata = patch.metadata;
    if (patch.address !== undefined) dbPatch.delivery_address = { address: patch.address };
    if (patch.payment_status !== undefined) dbPatch.payment_status = patch.payment_status;

    if (patch.customer_name || patch.customer_phone || patch.payment_method) {
      const current = await this.get(id);
      dbPatch.metadata = {
        ...(current.metadata || {}),
        ...(patch.customer_name ? { customer_name: patch.customer_name } : {}),
        ...(patch.customer_phone ? { customer_phone: patch.customer_phone } : {}),
        ...(patch.payment_method ? { payment_method: patch.payment_method } : {}),
      };
    }

    const { data, error } = await supabase.from("orders").update(dbPatch).eq("id", id).select("*").single();
    if (error) throw error;
    return hydrateOrder(data);
  },

  async delete(id) {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  },
};

const productEntity = {
  async list(sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    const { data, error } = await supabase.from("products").select("*").order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeProduct);
  },

  async filter(filter = {}, sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    let q = supabase.from("products").select("*");
    if (filter.status === "ACTIVE") q = q.eq("is_active", true);
    else if (filter.status === "INACTIVE") q = q.eq("is_active", false);
    else q = applyFilters(q, filter);
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeProduct);
  },

  async get(id) {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error) throw error;
    return normalizeProduct(data);
  },

  async create(input) {
    const row = {
      name: input.name,
      description: input.description || null,
      product_type: input.product_type || "gas_cylinder",
      sku: input.sku || null,
      price: Number(input.price || 0),
      stock: Number(input.stock || 0),
      reserved_stock: Number(input.reserved_stock || 0),
      sold_stock: Number(input.sold_stock || 0),
      is_active: input.status !== "INACTIVE",
      image_url: input.image || input.image_url || null,
      metadata: {
        ...(input.metadata || {}),
        cylinder_type: input.cylinder_type || "new",
        low_stock_threshold: input.low_stock_threshold ?? 10,
      },
    };
    const { data, error } = await supabase.from("products").insert(row).select("*").single();
    if (error) throw error;
    return normalizeProduct(data);
  },

  async update(id, input) {
    const current = await this.get(id);
    const metadata = {
      ...(current.metadata || {}),
      ...(input.cylinder_type !== undefined ? { cylinder_type: input.cylinder_type } : {}),
      ...(input.low_stock_threshold !== undefined ? { low_stock_threshold: input.low_stock_threshold } : {}),
    };
    const row = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: Number(input.price) } : {}),
      ...(input.stock !== undefined ? { stock: Number(input.stock) } : {}),
      ...(input.reserved_stock !== undefined ? { reserved_stock: Number(input.reserved_stock) } : {}),
      ...(input.sold_stock !== undefined ? { sold_stock: Number(input.sold_stock) } : {}),
      ...(input.status !== undefined ? { is_active: input.status === "ACTIVE" } : {}),
      ...(input.image !== undefined ? { image_url: input.image } : {}),
      metadata,
    };
    const { data, error } = await supabase.from("products").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return normalizeProduct(data);
  },

  async delete(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
};

const profileEntity = {
  async list(sort = "-created_date", limit = 200) {
    const spec = sortSpec(sort);
    const { data, error } = await supabase.from("profiles").select("*").order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeProfile);
  },

  async filter(filter = {}, sort = "-created_date", limit = 200) {
    const spec = sortSpec(sort);
    let q = applyFilters(supabase.from("profiles").select("*"), filter);
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeProfile);
  },

  async get(id) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return normalizeProfile(data);
  },

  async update(id, input) {
    const row = {};
    if (input.phone !== undefined) row.phone = input.phone;
    if (input.full_name !== undefined) row.full_name = input.full_name;
    if (input.role !== undefined) row.role = input.role;
    if (input.active !== undefined) row.is_active = input.active;
    const { data, error } = await supabase.from("profiles").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return normalizeProfile(data);
  },

  async delete(id) {
    // Browser clients cannot safely delete auth.users. Deactivate the profile instead.
    const { data, error } = await supabase.from("profiles").update({ is_active: false }).eq("id", id).select("*").single();
    if (error) throw error;
    return normalizeProfile(data);
  },
};

const notificationEntity = {
  async filter(filter = {}, sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    let q = applyFilters(supabase.from("notifications").select("*"), filter);
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeNotification);
  },
  async list(sort = "-created_date", limit = 100) {
    return this.filter({}, sort, limit);
  },
  async create(input) {
    const { data, error } = await supabase.from("notifications").insert({
      user_id: input.user_id,
      order_id: input.order_id || null,
      type: input.type || "SYSTEM",
      title: input.title || "",
      message: input.body || input.message || "",
      is_read: input.read ?? input.is_read ?? false,
      data: input.data || {},
    }).select("*").single();
    if (error) throw error;
    return normalizeNotification(data);
  },
  async update(id, input) {
    const row = {};
    if (input.read !== undefined) row.is_read = input.read;
    if (input.is_read !== undefined) row.is_read = input.is_read;
    if (input.read_at !== undefined) row.read_at = input.read_at;
    const { data, error } = await supabase.from("notifications").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return normalizeNotification(data);
  },
};

const historyEntity = {
  async filter(filter = {}, sort = "created_date", limit = 50) {
    const spec = sortSpec(sort);
    let q = applyFilters(supabase.from("order_history").select("*"), filter);
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return Promise.all((data || []).map(async (row) => {
      let performer = null;
      if (row.changed_by) {
        const result = await supabase.from("profiles").select("full_name,role").eq("id", row.changed_by).maybeSingle();
        performer = result.data;
      }
      return {
        ...row,
        new_status: row.to_status,
        old_status: row.from_status,
        performed_by_name: performer?.full_name || "",
        performed_by_role: performer?.role || "",
        created_date: row.created_at,
      };
    }));
  },
  async list(sort = "created_date", limit = 50) {
    return this.filter({}, sort, limit);
  },
};

const custodyEntity = {
  async list(sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    const { data, error } = await supabase.from("custody").select("*, party:profiles(id,full_name,role), product:products(id,name)").order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeCustody);
  },
  async filter(filter = {}, sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    let q = supabase.from("custody").select("*, party:profiles(id,full_name,role), product:products(id,name)");
    if (filter.user_id) q = q.eq("party_id", filter.user_id);
    if (filter.party_id) q = q.eq("party_id", filter.party_id);
    if (filter.product_id) q = q.eq("product_id", filter.product_id);
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeCustody);
  },
};

const transactionEntity = {
  async list(sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    const { data, error } = await supabase.from("cylinder_transactions").select("*, product:products(id,name)").order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map((row) => ({ ...normalizeTransaction(row), product_name: row.product?.name || "" }));
  },
  async filter(filter = {}, sort = "-created_date", limit = 100) {
    const spec = sortSpec(sort);
    let q = applyFilters(supabase.from("cylinder_transactions").select("*, product:products(id,name)"), filter);
    const { data, error } = await q.order(spec.column, { ascending: spec.ascending }).limit(limit);
    if (error) throw error;
    return (data || []).map((row) => ({ ...normalizeTransaction(row), product_name: row.product?.name || "" }));
  },
};

const entity = {
  Order: orderEntity,
  Product: productEntity,
  User: profileEntity,
  Notification: notificationEntity,
  OrderHistory: historyEntity,
  Custody: custodyEntity,
  CylinderTransaction: transactionEntity,
};

const invoke = async (name, payload = {}) => {
  if (name === "createOrder") {
    const { data, error } = await supabase.rpc("create_order", {
      p_items: payload.items || [],
      p_customer_name: payload.customer_name || "",
      p_customer_phone: payload.customer_phone || "",
      p_address: payload.address || "",
      p_latitude: payload.latitude ?? null,
      p_longitude: payload.longitude ?? null,
      p_payment_method: payload.payment_method || "CASH",
    });
    if (error) throw error;
    const order = await orderEntity.get(data.order.id);
    return { data: { order } };
  }

  if (name === "updateOrderStatus") {
    const { data, error } = await supabase.rpc("update_order_status", {
      p_order_id: payload.order_id,
      p_action: payload.action,
      p_extra: payload.extra || {},
    });
    if (error) throw error;
    const order = await orderEntity.get(payload.order_id);
    return { data: { ...data, order } };
  }

  if (name === "manageInventory") {
    const actionMap = {
      restock: "restock",
      adjust: "adjust",
      transfer_driver: "transfer_driver",
      transfer_distributor: "transfer_distributor",
    };
    const action = actionMap[payload.action] || payload.action;
    const { data, error } = await supabase.rpc("manage_inventory", {
      p_action: action,
      p_product_id: payload.product_id,
      p_quantity: Number(payload.quantity),
      p_notes: payload.notes || null,
      p_target_party_id: payload.target_party_id || payload.user_id || null,
      p_target_party_type: payload.target_party_type || null,
    });
    if (error) throw error;
    return { data };
  }

  if (name === "markNotificationRead") {
    const { data, error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: payload.notification_id || null,
      p_all: Boolean(payload.all),
    });
    if (error) throw error;
    return { data };
  }

  if (name === "notifyOrderCreated") {
    return { data: { ok: true } };
  }

  if (name === "processReturnExchange") {
    throw new Error("مرتجع واستبدال الطلبات سيتم نقلهما إلى Supabase في المرحلة التالية.");
  }

  throw new Error(`Unsupported application function: ${name}`);
};

export const base44 = {
  auth: {
    async updateMe(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error("AUTH_REQUIRED");

      const userId = sessionData.session.user.id;
      const { data, error } = await supabase
        .from("profiles")
        .update({ full_name: input.full_name, phone: input.phone })
        .eq("id", userId)
        .select("*")
        .single();

      if (error) throw error;
      return normalizeProfile(data);
    },
  },
  entities: entity,
  functions: { invoke },
  users: {
    async inviteUser() {
      throw new Error("دعوة مستخدم جديدة تحتاج Edge Function بصلاحية خادم، وسيتم نقلها في المرحلة التالية.");
    },
  },
};
