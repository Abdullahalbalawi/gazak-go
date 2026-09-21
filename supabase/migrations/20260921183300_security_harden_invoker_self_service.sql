begin;

-- Self-service profile edits: invoker + RLS + column-level UPDATE privilege.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

create or replace function public.update_profile_self(
  p_full_name text default null,
  p_phone text default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set full_name = coalesce(p_full_name, full_name),
      phone = coalesce(p_phone, phone),
      updated_at = now()
  where id = (select auth.uid())
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$function$;

-- Customer order detail edits: invoker + RLS + column-level UPDATE privilege.
drop policy if exists orders_customer_update_details on public.orders;
create policy orders_customer_update_details
on public.orders
for update
to authenticated
using (
  customer_id = (select auth.uid())
  and status in ('NEW','ACCEPTED')
)
with check (
  customer_id = (select auth.uid())
  and status in ('NEW','ACCEPTED')
);

revoke update on public.orders from authenticated;
grant update (delivery_address, latitude, longitude, requested_delivery_at, notes, updated_at) on public.orders to authenticated;

create or replace function public.update_customer_order_details(
  p_order_id uuid,
  p_delivery_address jsonb default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_requested_delivery_at timestamptz default null,
  p_notes text default null
)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_order public.orders;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.orders
  set delivery_address = coalesce(p_delivery_address, delivery_address),
      latitude = coalesce(p_latitude, latitude),
      longitude = coalesce(p_longitude, longitude),
      requested_delivery_at = coalesce(p_requested_delivery_at, requested_delivery_at),
      notes = coalesce(p_notes, notes),
      updated_at = now()
  where id = p_order_id
    and customer_id = (select auth.uid())
    and status in ('NEW','ACCEPTED')
  returning * into v_order;

  if not found then
    raise exception 'Order not found or not editable';
  end if;

  return v_order;
end;
$function$;

-- Notification read state: invoker + RLS + column-level UPDATE privilege.
drop policy if exists notifications_own_update_read on public.notifications;
create policy notifications_own_update_read
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke update on public.notifications from authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid default null,
  p_all boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_all then
    update public.notifications
    set is_read = true,
        read_at = now()
    where user_id = v_uid and not is_read;
  elsif p_notification_id is not null then
    update public.notifications
    set is_read = true,
        read_at = now()
    where id = p_notification_id and user_id = v_uid;
  end if;
end;
$function$;

revoke execute on function public.update_profile_self(text,text) from public, anon;
grant execute on function public.update_profile_self(text,text) to authenticated;

revoke execute on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text) from public, anon;
grant execute on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text) to authenticated;

revoke execute on function public.mark_notification_read(uuid,boolean) from public, anon;
grant execute on function public.mark_notification_read(uuid,boolean) to authenticated;

commit;
