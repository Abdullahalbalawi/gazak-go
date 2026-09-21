begin;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists orders_customer_update_details on public.orders;
drop policy if exists notifications_own_update_read on public.notifications;
commit;