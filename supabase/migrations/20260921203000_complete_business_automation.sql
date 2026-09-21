begin;

create table if not exists public.driver_locations (
  driver_id uuid primary key references public.profiles(id) on delete cascade,
  latitude numeric not null check (latitude between -90 and 90),
  longitude numeric not null check (longitude between -180 and 180),
  accuracy_m numeric,
  heading numeric,
  speed_kmh numeric,
  updated_at timestamptz not null default now()
);
alter table public.driver_locations enable row level security;
revoke all on table public.driver_locations from anon, authenticated;
grant select on table public.driver_locations to authenticated;
drop policy if exists driver_locations_authorized_read on public.driver_locations;
create policy driver_locations_authorized_read on public.driver_locations
for select to authenticated using (
  driver_id=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.role in('admin','distributor'))
);
create index if not exists driver_locations_updated_idx on public.driver_locations(updated_at desc);

create or replace function public.admin_update_user(p_user_id uuid,p_full_name text default null,p_phone text default null,p_role public.user_role default null,p_is_active boolean default null,p_actor_id uuid default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=coalesce(p_actor_id,(select auth.uid())); v_row public.profiles;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and is_active=true) then raise exception 'ADMIN_REQUIRED'; end if;
 update public.profiles set full_name=coalesce(p_full_name,full_name),phone=coalesce(p_phone,phone),role=coalesce(p_role,role),is_active=coalesce(p_is_active,is_active),updated_at=now() where id=p_user_id returning * into v_row;
 if not found then raise exception 'USER_NOT_FOUND'; end if; return v_row;
end $$;

create or replace function public.admin_deactivate_user(p_user_id uuid,p_actor_id uuid default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=coalesce(p_actor_id,(select auth.uid())); v_row public.profiles;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and is_active=true) then raise exception 'ADMIN_REQUIRED'; end if;
 if p_user_id=v_actor then raise exception 'CANNOT_DEACTIVATE_SELF'; end if;
 update public.profiles set is_active=false,updated_at=now() where id=p_user_id returning * into v_row;
 if not found then raise exception 'USER_NOT_FOUND'; end if; return v_row;
end $$;

create or replace function public.update_driver_location(p_driver_id uuid,p_latitude numeric,p_longitude numeric,p_accuracy_m numeric default null,p_heading numeric default null,p_speed_kmh numeric default null,p_actor_id uuid default null)
returns public.driver_locations language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=coalesce(p_actor_id,(select auth.uid())); v_row public.driver_locations;
begin
 if v_actor is null or v_actor<>p_driver_id or not exists(select 1 from public.profiles where id=v_actor and role='driver' and is_active=true) then raise exception 'DRIVER_REQUIRED'; end if;
 insert into public.driver_locations(driver_id,latitude,longitude,accuracy_m,heading,speed_kmh,updated_at)
 values(v_actor,p_latitude,p_longitude,p_accuracy_m,p_heading,p_speed_kmh,now())
 on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,heading=excluded.heading,speed_kmh=excluded.speed_kmh,updated_at=now()
 returning * into v_row;
 return v_row;
end $$;

create or replace function public.smart_assign_order(p_order_id uuid,p_driver_id uuid,p_actor_id uuid default null,p_max_detour_minutes numeric default 10,p_speed_kmh numeric default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=coalesce(p_actor_id,(select auth.uid())); v_order public.orders%rowtype; v_active public.orders%rowtype; v_loc public.driver_locations%rowtype;
 v_count integer:=0; v_base_km numeric; v_new_km numeric; v_leg_km numeric; v_detour_km numeric; v_base_min numeric; v_new_total_min numeric; v_delay_min numeric; v_same_route boolean:=false;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and is_active=true) then raise exception 'ADMIN_REQUIRED'; end if;
 if not exists(select 1 from public.profiles where id=p_driver_id and role='driver' and is_active=true) then raise exception 'INVALID_DRIVER'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_order.status<>'READY' then raise exception 'ORDER_NOT_READY'; end if;
 perform pg_advisory_xact_lock(hashtext(p_driver_id::text));
 select count(*) into v_count from public.orders where driver_id=p_driver_id and status in('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED');
 if v_count=0 then
   update public.orders set status='ASSIGNED',driver_id=p_driver_id,assigned_at=now(),updated_at=now() where id=p_order_id;
   insert into public.notifications(user_id,order_id,type,title,message,data) values(p_driver_id,p_order_id,'ORDER','تم إسناد طلب جديد إليك','طلب جديد بانتظار بدء التوصيل.',jsonb_build_object('status','ASSIGNED','dispatch_mode','DIRECT'));
   insert into public.order_history(order_id,from_status,to_status,changed_by,note,metadata) values(p_order_id,v_order.status,'ASSIGNED',v_actor,'smart_dispatch',jsonb_build_object('mode','DIRECT'));
   return jsonb_build_object('order_id',p_order_id,'driver_id',p_driver_id,'mode','DIRECT','delay_minutes',0);
 end if;
 if v_count>1 then raise exception 'DRIVER_HAS_TOO_MANY_ACTIVE_ORDERS'; end if;
 select * into v_active from public.orders where driver_id=p_driver_id and status in('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED')
 order by case status when 'ARRIVED' then 1 when 'OUT_FOR_DELIVERY' then 2 else 3 end,assigned_at limit 1 for update;
 select * into v_loc from public.driver_locations where driver_id=p_driver_id and updated_at>=now()-interval '10 minutes';
 if v_loc.driver_id is null or v_active.latitude is null or v_active.longitude is null or v_order.latitude is null or v_order.longitude is null then raise exception 'SMART_DISPATCH_REQUIRES_FRESH_LOCATION'; end if;
 v_base_km:=earth_distance(ll_to_earth(v_loc.latitude,v_loc.longitude),ll_to_earth(v_active.latitude,v_active.longitude))/1000.0;
 v_new_km:=earth_distance(ll_to_earth(v_loc.latitude,v_loc.longitude),ll_to_earth(v_order.latitude,v_order.longitude))/1000.0;
 v_leg_km:=earth_distance(ll_to_earth(v_order.latitude,v_order.longitude),ll_to_earth(v_active.latitude,v_active.longitude))/1000.0;
 v_detour_km:=greatest(0,(v_new_km+v_leg_km)-v_base_km);
 v_base_min:=(v_base_km/greatest(p_speed_kmh,10))*60+10;
 v_new_total_min:=((v_new_km+v_leg_km)/greatest(p_speed_kmh,10))*60+20;
 v_delay_min:=greatest(0,v_new_total_min-v_base_min);
 v_same_route:=(v_order.route_key is not null and v_order.route_key=v_active.route_key) or (v_detour_km<=1.5 and v_leg_km<=5);
 if not v_same_route then raise exception 'NOT_SAME_ROUTE'; end if;
 if v_delay_min>p_max_detour_minutes then raise exception 'WOULD_DELAY_ACTIVE_DELIVERY'; end if;
 if v_active.requested_delivery_at is not null and now()+(ceil(v_new_total_min)||' minutes')::interval>v_active.requested_delivery_at then raise exception 'WOULD_MISS_DELIVERY_WINDOW'; end if;
 update public.orders set status='ASSIGNED',driver_id=p_driver_id,assigned_at=now(),updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('dispatch_mode','SAME_ROUTE','dispatch_delay_minutes',round(v_delay_min,2)) where id=p_order_id;
 insert into public.notifications(user_id,order_id,type,title,message,data) values(p_driver_id,p_order_id,'ORDER','تم إسناد طلب على نفس مسارك','تمت إضافة الطلب دون تجاوز حد التأخير المسموح.',jsonb_build_object('status','ASSIGNED','dispatch_mode','SAME_ROUTE','delay_minutes',round(v_delay_min,2)));
 insert into public.order_history(order_id,from_status,to_status,changed_by,note,metadata) values(p_order_id,v_order.status,'ASSIGNED',v_actor,'smart_dispatch',jsonb_build_object('mode','SAME_ROUTE','delay_minutes',round(v_delay_min,2),'detour_km',round(v_detour_km,2)));
 return jsonb_build_object('order_id',p_order_id,'driver_id',p_driver_id,'mode','SAME_ROUTE','delay_minutes',round(v_delay_min,2),'detour_km',round(v_detour_km,2));
end $$;

create or replace function public.process_waiting_orders(p_actor_id uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_order public.orders%rowtype; v_item record; v_available boolean; v_count integer:=0;
begin
 if v_uid is null or not exists(select 1 from public.profiles where id=v_uid and role='admin' and is_active=true) then raise exception 'ADMIN_REQUIRED'; end if;
 for v_order in select * from public.orders where status='WAITING_STOCK' order by created_at for update skip locked loop
   v_available:=true;
   for v_item in select oi.product_id,oi.quantity,p.stock from public.order_items oi join public.products p on p.id=oi.product_id where oi.order_id=v_order.id loop
     if v_item.stock<v_item.quantity then v_available:=false; exit; end if;
   end loop;
   if v_available then
     for v_item in select oi.product_id,oi.quantity from public.order_items oi where oi.order_id=v_order.id loop
       update public.products set stock=stock-v_item.quantity,reserved_stock=reserved_stock+v_item.quantity,updated_at=now() where id=v_item.product_id and stock>=v_item.quantity;
       if not found then v_available:=false; exit; end if;
       insert into public.cylinder_transactions(product_id,transaction_type,quantity,order_id,performed_by,notes) values(v_item.product_id,'RESERVE'::public.cylinder_transaction_type,v_item.quantity,v_order.id,v_uid,'Waiting-stock order released');
     end loop;
     if v_available then
       update public.orders set status='NEW',updated_at=now() where id=v_order.id;
       insert into public.order_history(order_id,from_status,to_status,changed_by,note) values(v_order.id,'WAITING_STOCK','NEW',v_uid,'stock_available');
       insert into public.notifications(user_id,order_id,type,title,message,data) values(v_order.customer_id,v_order.id,'INVENTORY','توفر المخزون','توفر المخزون لطلبك وتمت إعادته إلى قائمة الطلبات.',jsonb_build_object('status','NEW'));
       v_count:=v_count+1;
     end if;
   end if;
 end loop;
 return v_count;
end $$;

revoke all on function public.admin_update_user(uuid,text,text,public.user_role,boolean,uuid) from public,anon,authenticated;
revoke all on function public.admin_deactivate_user(uuid,uuid) from public,anon,authenticated;
revoke all on function public.update_driver_location(uuid,numeric,numeric,numeric,numeric,numeric,uuid) from public,anon,authenticated;
revoke all on function public.smart_assign_order(uuid,uuid,uuid,numeric,numeric) from public,anon,authenticated;
revoke all on function public.process_waiting_orders(uuid) from public,anon,authenticated;
grant execute on function public.admin_update_user(uuid,text,text,public.user_role,boolean,uuid) to service_role;
grant execute on function public.admin_deactivate_user(uuid,uuid) to service_role;
grant execute on function public.update_driver_location(uuid,numeric,numeric,numeric,numeric,numeric,uuid) to service_role;
grant execute on function public.smart_assign_order(uuid,uuid,uuid,numeric,numeric) to service_role;
grant execute on function public.process_waiting_orders(uuid) to service_role;

commit;