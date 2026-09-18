-- Gazak Go - RLS performance hardening
-- Migration 017: evaluate auth context once per statement in exposed RLS policies.

alter policy "profiles_select_self_or_admin" on public.profiles
  using (((select auth.uid()) = id) or (select public.is_admin()));

alter policy "custody_select_own_or_admin" on public.custody
  using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy "notifications_select_own_or_admin" on public.notifications
  using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy "notifications_update_own_or_admin" on public.notifications
  using (((select auth.uid()) = user_id) or (select public.is_admin()))
  with check (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy "history_select_related" on public.order_history
  using (
    (select public.is_admin())
    or (select auth.uid()) = performed_by
    or (select auth.uid()) = customer_id
    or (select auth.uid()) = driver_id
    or (select auth.uid()) = distributor_id
  );

alter policy "transactions_select_authorized" on public.cylinder_transactions
  using (
    (select public.is_admin())
    or (select auth.uid()) = counterparty_id
    or (select auth.uid()) = performed_by
  );

alter policy "products_public_active_or_admin" on public.products
  using ((status = 'ACTIVE'::public.product_status) or (select public.is_admin()));

alter policy "orders_select_related" on public.orders
  using (
    (select public.is_admin())
    or (select auth.uid()) = customer_id
    or (select auth.uid()) = driver_id
    or (select auth.uid()) = distributor_id
    or (
      status = 'NEW'::public.order_status
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'distributor'::public.app_role
          and p.active = true
      )
    )
  );

alter policy "order_items_select_related" on public.order_items
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (
          (select public.is_admin())
          or (select auth.uid()) = o.customer_id
          or (select auth.uid()) = o.driver_id
          or (select auth.uid()) = o.distributor_id
        )
    )
  );

alter policy "payment_transactions_select_related" on public.payment_transactions
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.orders o
      where o.id = payment_transactions.order_id
        and (
          (select auth.uid()) = o.customer_id
          or (select auth.uid()) = o.driver_id
          or (select auth.uid()) = o.distributor_id
        )
    )
  );

alter policy "invoices_select_related" on public.invoices
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.orders o
      where o.id = invoices.order_id
        and (
          (select auth.uid()) = o.customer_id
          or (select auth.uid()) = o.driver_id
          or (select auth.uid()) = o.distributor_id
        )
    )
  );