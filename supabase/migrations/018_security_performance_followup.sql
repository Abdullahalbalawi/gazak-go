-- Gazak Go - Security/performance follow-up
-- Migration 018: restore internal authorization helper execution and add covering FK indexes.

grant execute on function public.is_admin() to authenticated;

create index if not exists custody_product_id_idx
  on public.custody(product_id);

create index if not exists cylinder_transactions_counterparty_id_idx
  on public.cylinder_transactions(counterparty_id);

create index if not exists cylinder_transactions_performed_by_idx
  on public.cylinder_transactions(performed_by);

create index if not exists notifications_order_id_idx
  on public.notifications(order_id);

create index if not exists order_history_customer_id_idx
  on public.order_history(customer_id);

create index if not exists order_history_driver_id_idx
  on public.order_history(driver_id);

create index if not exists order_history_distributor_id_idx
  on public.order_history(distributor_id);

create index if not exists order_history_performed_by_idx
  on public.order_history(performed_by);

create index if not exists order_items_product_id_idx
  on public.order_items(product_id);
