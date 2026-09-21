begin;
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
 v_base_km:=earth_distance(ll_to_earth(v_loc.latitude::float8,v_loc.longitude::float8),ll_to_earth(v_active.latitude::float8,v_active.longitude::float8))/1000.0;
 v_new_km:=earth_distance(ll_to_earth(v_loc.latitude::float8,v_loc.longitude::float8),ll_to_earth(v_order.latitude::float8,v_order.longitude::float8))/1000.0;
 v_leg_km:=earth_distance(ll_to_earth(v_order.latitude::float8,v_order.longitude::float8),ll_to_earth(v_active.latitude::float8,v_active.longitude::float8))/1000.0;
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
revoke all on function public.smart_assign_order(uuid,uuid,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.smart_assign_order(uuid,uuid,uuid,numeric,numeric) to service_role;
commit;