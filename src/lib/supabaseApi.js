import { supabase } from "@/lib/supabaseClient";

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
    const allowed = [
      "address",
      "latitude",
      "longitude",
      "requested_delivery_at",
      "notes",
    ];
    const unsupported = Object.keys(patch || {}).filter((key) => !allowed.includes(key));
    if (unsupported.length) {
      throw new Error(
        `Direct order mutation is disabled for protected fields: ${unsupported.join(", ")}. Use the application function API.`
      );
    }

    const { data, error } = await supabase.rpc("update_customer_order_details", {
      p_order_id: id,
      p_delivery_address: patch.address !== undefined ? { address: patch.address } : null,
      p_latitude: patch.latitude ?? null,
      p_longitude: patch.longitude ?? null,
      p_requested_delivery_at: patch.requested_delivery_at ?? null,
      p_notes: patch.notes ?? null,
    });
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
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id;
    if (!currentUserId) throw new Error("AUTH_REQUIRED");

    const protectedFields = ["role", "active"];
    const hasProtectedFields = protectedFields.some((field) => input[field] !== undefined);

    if (id === currentUserId && !hasProtectedFields) {
      const { data, error } = await supabase.rpc("update_profile_self", {
        p_full_name: input.full_name ?? null,
        p_phone: input.phone ?? null,
      });
      if (error) throw error;
      return normalizeProfile(data);
    }

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
    const shouldRead = input.read ?? input.is_read;
    if (shouldRead !== true) {
      throw new Error("Notification updates are limited to marking notifications as read.");
    }
    const { data, error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: id,
      p_all: false,
    });
    if (error) throw error;
    const notification = await supabase.from("notifications").select("*").eq("id", id).single();
    if (notification.error) throw notification.error;
    return normalizeNotification(notification.data);
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
  const functionMap = {
    createOrder: "create-order",
    updateOrderStatus: "update-order-status",
    manageInventory: "manage-inventory",
    markNotificationRead: "mark-notification-read",
  };

  if (functionMap[name]) {
    const { data, error } = await supabase.functions.invoke(functionMap[name], {
      body: payload,
    });
    if (error) throw error;

    if (name === "createOrder") {
      const order = await orderEntity.get(data.data.order.id);
      return { data: { order } };
    }

    if (name === "updateOrderStatus") {
      const order = await orderEntity.get(payload.order_id);
      return { data: { ...(data.data || {}), order } };
    }

    return { data: data.data ?? data };
  }

  if (name === "notifyOrderCreated") {
    return { data: { ok: true } };
  }

  if (name === "processReturnExchange") {
    const { data, error } = await supabase.functions.invoke("process-return-exchange", {
      body: payload,
    });
    if (error) throw error;
    return { data };
  }

  throw new Error(`Unsupported application function: ${name}`);
};

const auth = {
  async me() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error("AUTH_REQUIRED");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();
    if (profileError) throw profileError;

    return normalizeProfile({
      ...profile,
      email: userData.user.email || profile.email || null,
    });
  },

  async updateMe(input = {}) {
    const { data, error } = await supabase.rpc("update_profile_self", {
      p_full_name: input.full_name ?? null,
      p_phone: input.phone ?? null,
    });
    if (error) throw error;
    return normalizeProfile(data);
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

export const supabaseApi = {
  auth,
  entities: entity,
  functions: {
    invoke,
  },
};
