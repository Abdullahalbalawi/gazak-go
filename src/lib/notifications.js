import { CUSTOMER_NOTIFICATIONS } from "@/lib/orderStatus";

// Notifications are generated transactionally by Supabase database workflows.
// Client code should not insert notification rows directly.
export async function createNotification() { return null; }
export async function notifyCustomerOnStatus(order) { return CUSTOMER_NOTIFICATIONS[order?.status] || null; }
export async function notifyDriverAssigned(order) { return order?.driver_id ? true : false; }
export async function notifyDistributorsNewOrder(order) { return order?.id ? true : false; }
