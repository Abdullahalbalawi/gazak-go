begin;
create or replace function public.update_order_status(p_order_id uuid,p_action text,p_extra jsonb default '{}'::jsonb,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_role public.user_role; v_order public.orders%rowtype; v_new_status public.order_status; v_driver_id uuid; v_target_status public.order_status; v_effective_action text:=p_action; v_result jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select role into v_role from public.profiles where id=v_uid and is_active=true;
 if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if p_action='delete' then
   if v_role<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
   if v_order.status<>'CANCELLED' then raise exception 'ONLY_CANCELLED_ORDERS_CAN_BE_DELETED'; end if;
   delete from public.cylinder_transactions where order_id=p_order_id; delete from public.notifications where order_id=p_order_id; delete from public.order_history where order_id=p_order_id; delete from public.order_items where order_id=p_order_id; delete from public.orders where id=p_order_id;
   return jsonb_build_object('order_id',p_order_id,'deleted',true);
 end if;
 if p_action='reassign' then
   if v_role<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
   if v_order.status<>'ASSIGNED' then raise exception 'CANNOT_REASSIGN_IN_PROGRESS'; end if;
   v_driver_id:=(p_extra->>'driver_id')::uuid;
   if v_driver_id is null then raise exception 'DRIVER_REQUIRED'; end if;
   if not exists(select 1 from public.profiles where id=v_driver_id and role='driver' and is_active=true) then raise exception 'INVALID_DRIVER'; end if;
   if exists(select 1 from public.orders where driver_id=v_driver_id and status in('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED')) then raise exception 'DRIVER_HAS_ACTIVE_ORDER'; end if;
   update public.orders set driver_id=v_driver_id,assigned_at=now(),updated_at=now() where id=p_order_id;
   insert into public.notifications(user_id,order_id,type,title,message,data) values(v_driver_id,p_order_id,'ORDER','تم إعادة إسناد طلب إليك','طلب جديد بانتظار بدء التوصيل.',jsonb_build_object('status','ASSIGNED','dispatch_mode','REASSIGN'));
   insert into public.order_history(order_id,from_status,to_status,changed_by,note,metadata) values(p_order_id,'ASSIGNED','ASSIGNED',v_uid,'reassign',jsonb_build_object('driver_id',v_driver_id));
   return jsonb_build_object('order_id',p_order_id,'status','ASSIGNED','driver_id',v_driver_id);
 end if;
 if p_action='manualStatus' then
   if v_role<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
   v_target_status:=(p_extra->>'status')::public.order_status;
   if v_target_status=v_order.status then return jsonb_build_object('order_id',p_order_id,'status',v_order.status); end if;
   v_effective_action:=case
     when v_order.status='NEW' and v_target_status='ACCEPTED' then 'accept'
     when v_order.status='ACCEPTED' and v_target_status='PREPARING' then 'prepare'
     when v_order.status='PREPARING' and v_target_status='READY' then 'ready'
     when v_order.status='READY' and v_target_status='ASSIGNED' then 'assign'
     when v_order.status='ASSIGNED' and v_target_status='OUT_FOR_DELIVERY' then 'startDelivery'
     when v_order.status='OUT_FOR_DELIVERY' and v_target_status='ARRIVED' then 'arrive'
     when v_order.status='ARRIVED' and v_target_status='DELIVERED' then 'deliver'
     when v_order.status in('NEW','ACCEPTED','PREPARING','WAITING_STOCK','OUT_OF_STOCK') and v_target_status='CANCELLED' then 'cancel'
     else null end;
   if v_effective_action is null then raise exception 'INVALID_MANUAL_STATUS_TRANSITION'; end if;
 end if;
 if v_effective_action='accept' and v_order.status='NEW' and v_role in('distributor','admin') then
   v_new_status:='ACCEPTED'; update public.orders set status=v_new_status,distributor_id=coalesce((p_extra->>'distributor_id')::uuid,v_uid),updated_at=now() where id=p_order_id;
 elsif v_effective_action='prepare' and v_order.status='ACCEPTED' and v_role in('distributor','admin') then
   v_new_status:='PREPARING'; update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
 elsif v_effective_action='ready' and v_order.status='PREPARING' and v_role in('distributor','admin') then
   v_new_status:='READY'; update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
 elsif v_effective_action='assign' and v_order.status='READY' and v_role='admin' then
   v_driver_id:=(p_extra->>'driver_id')::uuid; if v_driver_id is null then raise exception 'DRIVER_REQUIRED'; end if;
   select public.smart_assign_order(p_order_id,v_driver_id,v_uid) into v_result; return v_result;
 elsif v_effective_action='startDelivery' and v_order.status='ASSIGNED' and v_role in('driver','admin') then
   if v_role='driver' and v_order.driver_id<>v_uid then raise exception 'NOT_ASSIGNED_TO_DRIVER'; end if;
   v_new_status:='OUT_FOR_DELIVERY'; update public.orders set status=v_new_status,out_for_delivery_at=now(),updated_at=now() where id=p_order_id;
 elsif v_effective_action='arrive' and v_order.status='OUT_FOR_DELIVERY' and v_role in('driver','admin') then
   if v_role='driver' and v_order.driver_id<>v_uid then raise exception 'NOT_ASSIGNED_TO_DRIVER'; end if;
   v_new_status:='ARRIVED'; update public.orders set status=v_new_status,updated_at=now() where id=p_order_id;
 elsif v_effective_action='deliver' and v_order.status='ARRIVED' and v_role in('driver','admin') then
   if v_role='driver' and v_order.driver_id<>v_uid then raise exception 'NOT_ASSIGNED_TO_DRIVER'; end if;
   v_new_status:='DELIVERED'; update public.orders set status=v_new_status,delivered_at=now(),updated_at=now() where id=p_order_id;
   update public.products p set reserved_stock=greatest(0,p.reserved_stock-oi.quantity),sold_stock=p.sold_stock+oi.quantity,updated_at=now() from public.order_items oi where oi.order_id=p_order_id and oi.product_id=p.id;
   insert into public.cylinder_transactions(product_id,transaction_type,quantity,order_id,performed_by,notes) select oi.product_id,'SALE'::public.cylinder_transaction_type,oi.quantity,p_order_id,v_uid,'Order delivered' from public.order_items oi where oi.order_id=p_order_id;
 elsif v_effective_action='cancel' and v_order.status in('NEW','ACCEPTED','PREPARING','WAITING_STOCK','OUT_OF_STOCK') and v_role in('customer','admin') then
   if v_role='customer' and v_order.customer_id<>v_uid then raise exception 'NOT_ORDER_OWNER'; end if;
   v_new_status:='CANCELLED'; update public.orders set status=v_new_status,cancelled_at=now(),cancellation_reason=coalesce(p_extra->>'reason','Cancelled'),updated_at=now() where id=p_order_id;
   if v_order.status not in('WAITING_STOCK','OUT_OF_STOCK') then
     update public.products p set stock=p.stock+oi.quantity,reserved_stock=greatest(0,p.reserved_stock-oi.quantity),updated_at=now() from public.order_items oi where oi.order_id=p_order_id and oi.product_id=p.id;
     insert into public.cylinder_transactions(product_id,transaction_type,quantity,order_id,performed_by,notes) select oi.product_id,'RELEASE'::public.cylinder_transaction_type,oi.quantity,p_order_id,v_uid,'Order cancelled' from public.order_items oi where oi.order_id=p_order_id;
   end if;
 else raise exception 'INVALID_STATUS_TRANSITION'; end if;
 insert into public.order_history(order_id,from_status,to_status,changed_by,note) values(p_order_id,v_order.status,v_new_status,v_uid,coalesce(p_extra->>'reason',v_effective_action));
 if v_order.customer_id is not null then
   insert into public.notifications(user_id,order_id,type,title,message,data) values(v_order.customer_id,p_order_id,'ORDER'::public.notification_type,
   case v_new_status when 'ACCEPTED' then 'تم قبول طلبك' when 'PREPARING' then 'طلبك قيد التجهيز' when 'OUT_FOR_DELIVERY' then 'طلبك خرج للتوصيل' when 'ARRIVED' then 'وصل السائق' when 'DELIVERED' then 'تم التسليم' when 'CANCELLED' then 'تم إلغاء طلبك' else 'تم تحديث طلبك' end,
   case v_new_status when 'ACCEPTED' then 'بدأ الموزع في تجهيز طلبك.' when 'PREPARING' then 'جاري تجهيز أسطواناتك الآن.' when 'OUT_FOR_DELIVERY' then 'السائق في طريقه إليك.' when 'ARRIVED' then 'وصل السائق إلى موقعك، يرجى الاستلام.' when 'DELIVERED' then 'تم تسليم طلبك بنجاح.' when 'CANCELLED' then 'تم إلغاء طلبك.' else 'تم تحديث حالة طلبك.' end,jsonb_build_object('status',v_new_status));
 end if;
 return jsonb_build_object('order_id',p_order_id,'status',v_new_status);
end $$;
commit;