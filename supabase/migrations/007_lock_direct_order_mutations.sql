-- Order mutations must go through transactional RPCs; do not allow browser clients to change status, totals or assignment directly.
drop policy if exists orders_customer_insert on public.orders;
drop policy if exists orders_related_update on public.orders;
drop policy if exists order_items_insert_customer on public.order_items;
create policy orders_admin_update on public.orders
for update using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin_insert on public.order_items
for insert with check (public.is_admin());
