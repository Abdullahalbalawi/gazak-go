-- Gazak Go - Smart dispatch
-- Rules: idle drivers are eligible; an active driver can receive another stop only when
-- it is on the same route and the new delivery ETA is not earlier than the driver's latest ETA.
create or replace function public.assign_order_smart(p_order_id uuid, p_driver_id uuid default null)
returns public.orders
security definer
set search_path = public
language plpgsql
as $$
declare
  v_actor public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_driver public.profiles%rowtype;
  v_active_count integer;
  v_latest_eta timestamptz;
  v_same_route boolean;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found or v_actor.role not in ('admin','distributor') then raise exception 'Only admin or distributor can dispatch orders'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'READY' then raise exception 'Only READY orders can be dispatched'; end if;

  if p_driver_id is null then
    select p.* into v_driver
    from public.profiles p
    where p.role = 'driver' and p.active = true
      and not exists (select 1 from public.orders o where o.driver_id = p.id and o.status in ('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED'))
    order by p.created_at asc
    limit 1;
    if not found then raise exception 'No eligible idle driver is available'; end if;
  else
    select * into v_driver from public.profiles where id = p_driver_id and role = 'driver' and active = true;
    if not found then raise exception 'Driver is unavailable'; end if;
    select count(*), max(o.estimated_delivery_at) into v_active_count, v_latest_eta
    from public.orders o where o.driver_id = v_driver.id and o.status in ('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED') and o.id <> v_order.id;
    if v_active_count > 0 then
      v_same_route := exists (
        select 1 from public.orders o
        where o.driver_id = v_driver.id and o.id <> v_order.id
          and o.status in ('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED')
          and o.route_group is not null and o.route_group = v_order.route_group
      );
      if not v_same_route or v_order.estimated_delivery_at is null or v_latest_eta is null or v_order.estimated_delivery_at < v_latest_eta then
        raise exception 'Driver already has an ongoing order and this assignment could delay the route';
      end if;
    end if;
  end if;

  update public.orders
  set driver_id = v_driver.id, assigned_at = coalesce(assigned_at, now()), updated_at = now()
  where id = v_order.id;

  insert into public.order_history(order_id, previous_status, new_status, performed_by, performed_by_name, performed_by_role, customer_id, driver_id, distributor_id, note)
  values (v_order.id, v_order.status, 'ASSIGNED', auth.uid(), v_actor.full_name, v_actor.role, v_order.customer_id, v_driver.id, v_order.distributor_id,
          case when v_active_count > 0 then 'Smart dispatch: same route, no ETA delay' else 'Smart dispatch: idle driver' end);

  insert into public.notifications(user_id, title, body, order_id, type)
  values (v_driver.id, 'طلب جديد', 'تم إسناد طلب توصيل جديد إليك.', v_order.id, 'dispatch');

  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end;
$$;

revoke all on function public.assign_order_smart(uuid,uuid) from public;
grant execute on function public.assign_order_smart(uuid,uuid) to authenticated;
