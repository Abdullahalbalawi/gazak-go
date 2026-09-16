import { supabase } from "@/lib/supabaseClient";

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const productsApi = {
  list: async ({ activeOnly = false } = {}) => {
    let query = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (activeOnly) query = query.eq("status", "ACTIVE");
    return unwrap(await query);
  },
  get: async (id) => unwrap(await supabase.from("products").select("*").eq("id", id).single()),
};

export const ordersApi = {
  list: async ({ customerId, driverId, distributorId, status } = {}) => {
    let query = supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (customerId) query = query.eq("customer_id", customerId);
    if (driverId) query = query.eq("driver_id", driverId);
    if (distributorId) query = query.eq("distributor_id", distributorId);
    if (status) query = query.eq("status", status);
    return unwrap(await query);
  },
  get: async (id) => unwrap(await supabase.from("orders").select("*, order_items(*), order_history(*)").eq("id", id).single()),
};

export const notificationsApi = {
  list: async (userId) => unwrap(await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false })),
  markRead: async (id) => unwrap(await supabase.from("notifications").update({ read: true }).eq("id", id).select().single()),
};

export const profilesApi = {
  get: async (id) => unwrap(await supabase.from("profiles").select("*").eq("id", id).single()),
};
