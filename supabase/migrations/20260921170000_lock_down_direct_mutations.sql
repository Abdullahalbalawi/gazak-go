begin;

drop policy if exists orders_authorized_update on public.orders;
drop policy if exists order_items_customer_insert on public.order_items;
drop policy if exists order_history_authorized_insert on public.order_history;
drop policy if exists notifications_own_insert on public.notifications;
drop policy if exists notifications_own_update on public.notifications;
drop policy if exists profiles_self_update on public.profiles;

create or replace function public.update_profile_self(
  p_full_name text default null,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.update_profile_self(text,text) from public, anon;
grant execute on function public.update_profile_self(text,text) to authenticated;

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
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text) from public, anon;
grant execute on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text) to authenticated;

commit;
