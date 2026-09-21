begin;

create or replace function public.create_order(
  p_items jsonb,p_customer_name text,p_customer_phone text,p_address text,
  p_latitude numeric default null,p_longitude numeric default null,
  p_payment_method text default 'CASH',p_actor_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_order_id uuid; v_subtotal numeric:=0; v_delivery_fee numeric:=15; v_total numeric:=0; v_item jsonb; v_product_id uuid; v_quantity integer; v_price numeric; v_product_name text; v_stock integer; v_is_active boolean;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and is_active=true and role='customer') then raise exception 'CUSTOMER_REQUIRED'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_CART'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer;
  if v_quantity is null or v_quantity<=0 then raise exception 'INVALID_QUANTITY'; end if;
  select p.price,p.name,p.stock,p.is_active into v_price,v_product_name,v_stock,v_is_active from public.products p where p.id=v_product_id for update;
  if not found or not v_is_active then raise exception 'PRODUCT_UNAVAILABLE:%',v_product_id; end if;
  if v_stock<v_quantity then raise exception 'OUT_OF_STOCK:%',v_product_name; end if;
  v_subtotal:=v_subtotal+(v_price*v_quantity);
 end loop;
 v_total:=v_subtotal+v_delivery_fee;
 insert into public.orders(customer_id,status,payment_status,subtotal,delivery_fee,total,delivery_address,latitude,longitude,metadata)
 values(v_uid,'NEW'::public.order_status,'PENDING'::public.payment_status,v_subtotal,v_delivery_fee,v_total,jsonb_build_object('address',coalesce(p_address,'')),p_latitude,p_longitude,jsonb_build_object('customer_name',coalesce(p_customer_name,''),'customer_phone',coalesce(p_customer_phone,''),'payment_method',coalesce(p_payment_method,'CASH'))) returning id into v_order_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_product_id:=(v_item->>'product_id')::uuid; v_quantity:=(v_item->>'quantity')::integer;
  select p.price,p.name into v_price,v_product_name from public.products p where p.id=v_product_id for update;
  insert into public.order_items(order_id,product_id,quantity,unit_price) values(v_order_id,v_product_id,v_quantity,v_price);
  update public.products set stock=stock-v_quantity,reserved_stock=reserved_stock+v_quantity,updated_at=now() where id=v_product_id;
  insert into public.cylinder_transactions(product_id,transaction_type,quantity,order_id,performed_by,notes) values(v_product_id,'RESERVE'::public.cylinder_transaction_type,v_quantity,v_order_id,v_uid,'Order stock reservation');
 end loop;
 insert into public.order_history(order_id,from_status,to_status,changed_by,note) values(v_order_id,null,'NEW'::public.order_status,v_uid,'Order created');
 insert into public.notifications(user_id,order_id,type,title,message,data) values(v_uid,v_order_id,'ORDER'::public.notification_type,'تم استلام طلبك','وصل طلبك إلينا وجاري معالجته.',jsonb_build_object('status','NEW'));
 return jsonb_build_object('order',jsonb_build_object('id',v_order_id,'customer_id',v_uid,'status','NEW','subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'total',v_total));
end;$function$;

create or replace function public.update_order_status(p_order_id uuid,p_action text,p_extra jsonb default '{}'::jsonb,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_role public.user_role; v_order public.orders%rowtype; v_new_status public.order_status; v_driver_id uuid; v_existing_count integer;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select role into v_role from public.profiles where id=v_uid and is_active=true; if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;
 select * into v_order from public.orders where id=p_order_id for update; if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if p_action='accept' and v_order.status='NEW' and v_role in('distributor','admin') then v_new_status:='ACCEPTED'; update public.orders set status=v_new_status,distributor_id=coalesce((p_extra->>'distributor_id')::uuid,v_uid),updated_at=now() where id=p_order_id;
 elsif p_action='prepare' and v_order.status='ACCEPTED' and v_role in('distributor','admin') then v_new_status:='PREPARING'; update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
 elsif p_action='ready' and v_order.status='PREPARING' and v_role in('distributor','admin') then v_new_status:='READY'; update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
 elsif p_action='assign' and v_order.status='READY' and v_role='admin' then
  v_driver_id:=(p_extra->>'driver_id')::uuid; if v_driver_id is null then raise exception 'DRIVER_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=v_driver_id and role='driver' and is_active=true) then raise exception 'INVALID_DRIVER'; end if;
  select count(*) into v_existing_count from public.orders where driver_id=v_driver_id and status in('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED'); if v_existing_count>0 then raise exception 'DRIVER_HAS_ACTIVE_ORDER'; end if;
  v_new_status:='ASSIGNED'; update public.orders set status=v_new_status,driver_id=v_driver_id,assigned_at=now(),updated_at=now() where id=p_order_id;
  insert into public.notifications(user_id,order_id,type,title,message,data) values(v_driver_id,p_order_id,'ORDER'::public.notification_type,'تم إسناد طلب جديد إليك','طلب جديد بانتظار قبولك.',jsonb_build_object('status','ASSIGNED'));
 elsif p_action='startDelivery' and v_order.status='ASSIGNED' and v_role in('driver','admin') then if v_role='driver' and v_order.driver_id<>v_uid then raise exception 'NOT_ASSIGNED_TO_DRIVER'; end if; v_new_status:='OUT_FOR_DELIVERY'; update public.orders set status=v_new_status,out_for_delivery_at=now(),updated_at=now() where id=p_order_id;
 elsif p_action='arrive' and v_order.status='OUT_FOR_DELIVERY' and v_role in('driver','admin') then if v_role='driver' and v_order.driver_id<>v_uid then raise exception 'NOT_ASSIGNED_TO_DRIVER'; end if; v_new_status:='ARRIVED'; update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
 elsif p_action='deliver' and v_order.status='ARRIVED' and v_role in('driver','admin') then
  if v_role='driver' and v_order.driver_id<>v_uid then raise exception 'NOT_ASSIGNED_TO_DRIVER'; end if; v_new_status:='DELIVERED'; update public.orders set status=v_new_status,delivered_at=now(),updated_at=now() where id=p_order_id;
  update public.products p set reserved_stock=greatest(0,p.reserved_stock-oi.quantity),sold_stock=p.sold_stock+oi.quantity,updated_at=now() from public.order_items oi where oi.order_id=p_order_id and oi.product_id=p.id;
  insert into public.cylinder_transactions(product_id,transaction_type,quantity,order_id,performed_by,notes) select oi.product_id,'SALE'::public.cylinder_transaction_type,oi.quantity,p_order_id,v_uid,'Order delivered' from public.order_items oi where oi.order_id=p_order_id;
 elsif p_action='cancel' and v_order.status in('NEW','ACCEPTED','PREPARING') and v_role in('customer','admin') then
  if v_role='customer' and v_order.customer_id<>v_uid then raise exception 'NOT_ORDER_OWNER'; end if; v_new_status:='CANCELLED'; update public.orders set status=v_new_status,cancelled_at=now(),cancellation_reason=coalesce(p_extra->>'reason','Cancelled'),updated_at=now() where id=p_order_id;
  update public.products p set stock=p.stock+oi.quantity,reserved_stock=greatest(0,p.reserved_stock-oi.quantity),updated_at=now() from public.order_items oi where oi.order_id=p_order_id and oi.product_id=p.id;
  insert into public.cylinder_transactions(product_id,transaction_type,quantity,order_id,performed_by,notes) select oi.product_id,'RELEASE'::public.cylinder_transaction_type,oi.quantity,p_order_id,v_uid,'Order cancelled' from public.order_items oi where oi.order_id=p_order_id;
 else raise exception 'INVALID_STATUS_TRANSITION'; end if;
 insert into public.order_history(order_id,from_status,to_status,changed_by,note) values(p_order_id,v_order.status,v_new_status,v_uid,p_action);
 if v_order.customer_id is not null then insert into public.notifications(user_id,order_id,type,title,message,data) values(v_order.customer_id,p_order_id,'ORDER'::public.notification_type,'تم تحديث طلبك','تم تحديث حالة طلبك.',jsonb_build_object('status',v_new_status)); end if;
 return jsonb_build_object('order_id',p_order_id,'status',v_new_status);
end;$function$;

create or replace function public.manage_inventory(p_action text,p_product_id uuid,p_quantity integer,p_notes text default null,p_target_party_id uuid default null,p_target_party_type public.custody_party_type default null,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_role public.user_role; v_new_stock integer;
begin
 select role into v_role from public.profiles where id=v_uid and is_active=true;
 if v_uid is null or v_role<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_quantity<=0 then raise exception 'INVALID_QUANTITY'; end if;
 if p_action='restock' then update public.products set stock=stock+p_quantity,updated_at=now() where id=p_product_id returning stock into v_new_stock; if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
 elsif p_action='adjust' then update public.products set stock=p_quantity,updated_at=now() where id=p_product_id returning stock into v_new_stock; if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
 elsif p_action in('transfer_driver','transfer_distributor') then
  if p_target_party_id is null or p_target_party_type is null then raise exception 'TARGET_PARTY_REQUIRED'; end if;
  update public.products set stock=stock-p_quantity,updated_at=now() where id=p_product_id and stock>=p_quantity returning stock into v_new_stock; if not found then raise exception 'INSUFFICIENT_STOCK'; end if;
  insert into public.custody(party_id,party_type,product_id,quantity) values(p_target_party_id,p_target_party_type,p_product_id,p_quantity) on conflict(party_id,product_id) do update set quantity=public.custody.quantity+excluded.quantity,updated_at=now();
 else raise exception 'UNKNOWN_INVENTORY_ACTION'; end if;
 return jsonb_build_object('product_id',p_product_id,'stock',v_new_stock);
end;$function$;

revoke execute on function public.create_order(jsonb,text,text,text,numeric,numeric,text,uuid) from public,anon,authenticated;
revoke execute on function public.update_order_status(uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke execute on function public.manage_inventory(text,uuid,integer,text,uuid,public.custody_party_type,uuid) from public,anon,authenticated;
grant execute on function public.create_order(jsonb,text,text,text,numeric,numeric,text,uuid) to service_role;
grant execute on function public.update_order_status(uuid,text,jsonb,uuid) to service_role;
grant execute on function public.manage_inventory(text,uuid,integer,text,uuid,public.custody_party_type,uuid) to service_role;
commit;