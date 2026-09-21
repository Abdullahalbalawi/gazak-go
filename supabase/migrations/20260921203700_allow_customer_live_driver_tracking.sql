begin;
drop policy if exists driver_locations_customer_read on public.driver_locations;
drop policy if exists driver_locations_authorized_read on public.driver_locations;
create policy driver_locations_authorized_read on public.driver_locations for select to authenticated using (
  driver_id=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.role in('admin','distributor'))
  or exists(select 1 from public.orders o where o.driver_id=driver_locations.driver_id and o.customer_id=(select auth.uid()) and o.status in('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED'))
);
commit;