begin;

drop policy if exists custody_admin_write on public.custody;
create policy custody_admin_insert on public.custody for insert to authenticated with check (private.is_admin());
create policy custody_admin_update on public.custody for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy custody_admin_delete on public.custody for delete to authenticated using (private.is_admin());

drop policy if exists transactions_admin_write on public.cylinder_transactions;
create policy transactions_admin_insert on public.cylinder_transactions for insert to authenticated with check (private.is_admin());
create policy transactions_admin_update on public.cylinder_transactions for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy transactions_admin_delete on public.cylinder_transactions for delete to authenticated using (private.is_admin());

drop policy if exists orders_distributor_read on public.orders;
drop policy if exists orders_authorized_read on public.orders;
create policy orders_authorized_read_combined on public.orders for select to authenticated using (
  customer_id=(select auth.uid()) or driver_id=(select auth.uid()) or distributor_id=(select auth.uid()) or private.is_admin()
  or ((select p.role from public.profiles p where p.id=(select auth.uid()))='distributor' and status in('NEW','ACCEPTED','PREPARING','READY'))
);

drop policy if exists products_admin_write on public.products;
create policy products_admin_insert on public.products for insert to authenticated with check (private.is_admin());
create policy products_admin_update on public.products for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy products_admin_delete on public.products for delete to authenticated using (private.is_admin());

drop policy if exists profiles_distributor_driver_read on public.profiles;
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_authorized_read on public.profiles for select to authenticated using (
  id=(select auth.uid()) or private.is_admin()
  or ((select p.role from public.profiles p where p.id=(select auth.uid()))='distributor' and role in('driver','distributor'))
);

commit;