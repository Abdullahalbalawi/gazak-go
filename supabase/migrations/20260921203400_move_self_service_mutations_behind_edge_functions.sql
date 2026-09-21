begin;

create or replace function public.update_profile_self(p_full_name text default null,p_phone text default null,p_actor_id uuid default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_profile public.profiles;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.profiles set full_name=coalesce(p_full_name,full_name),phone=coalesce(p_phone,phone),updated_at=now() where id=v_uid returning * into v_profile;
 if not found then raise exception 'Profile not found'; end if;
 return v_profile;
end $$;

create or replace function public.update_customer_order_details(p_order_id uuid,p_delivery_address jsonb default null,p_latitude numeric default null,p_longitude numeric default null,p_requested_delivery_at timestamptz default null,p_notes text default null,p_actor_id uuid default null)
returns public.orders language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_order public.orders;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.orders set delivery_address=coalesce(p_delivery_address,delivery_address),latitude=coalesce(p_latitude,latitude),longitude=coalesce(p_longitude,longitude),requested_delivery_at=coalesce(p_requested_delivery_at,requested_delivery_at),notes=coalesce(p_notes,notes),updated_at=now()
 where id=p_order_id and customer_id=v_uid and status in('NEW','ACCEPTED') returning * into v_order;
 if not found then raise exception 'Order not found or not editable'; end if;
 return v_order;
end $$;

create or replace function public.mark_notification_read(p_notification_id uuid default null,p_all boolean default false,p_actor_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_count integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_all then
   update public.notifications set is_read=true,read_at=now() where user_id=v_uid and is_read=false;
   get diagnostics v_count=row_count;
 else
   update public.notifications set is_read=true,read_at=now() where id=p_notification_id and user_id=v_uid and is_read=false;
   get diagnostics v_count=row_count;
 end if;
 return coalesce(v_count,0);
end $$;

revoke all on function public.update_profile_self(text,text) from public,anon,authenticated;
revoke all on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text) from public,anon,authenticated;
revoke all on function public.mark_notification_read(uuid,boolean) from public,anon,authenticated;
revoke all on function public.update_profile_self(text,text,uuid) from public,anon,authenticated;
revoke all on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text,uuid) from public,anon,authenticated;
revoke all on function public.mark_notification_read(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.update_profile_self(text,text,uuid) to service_role;
grant execute on function public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text,uuid) to service_role;
grant execute on function public.mark_notification_read(uuid,boolean,uuid) to service_role;

commit;