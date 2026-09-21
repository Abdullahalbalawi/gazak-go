begin;
create or replace function public.manage_inventory(p_action text,p_product_id uuid,p_quantity integer,p_notes text default null,p_target_party_id uuid default null,p_target_party_type public.custody_party_type default null,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=coalesce(p_actor_id,(select auth.uid())); v_role public.user_role; v_new_stock integer; v_released integer:=0;
begin
 select role into v_role from public.profiles where id=v_uid and is_active=true;
 if v_uid is null or v_role<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_quantity=0 then raise exception 'INVALID_QUANTITY'; end if;
 if p_action='restock' then
   if p_quantity<0 then raise exception 'INVALID_QUANTITY'; end if;
   update public.products set stock=stock+p_quantity,updated_at=now() where id=p_product_id returning stock into v_new_stock;
   if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
   insert into public.cylinder_transactions(product_id,transaction_type,quantity,performed_by,notes,metadata) values(p_product_id,'RESTOCK'::public.cylinder_transaction_type,p_quantity,v_uid,p_notes,jsonb_build_object('delta',p_quantity));
   v_released:=public.process_waiting_orders(v_uid);
 elsif p_action='adjust' then
   update public.products set stock=greatest(0,stock+p_quantity),updated_at=now() where id=p_product_id returning stock into v_new_stock;
   if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
   insert into public.cylinder_transactions(product_id,transaction_type,quantity,performed_by,notes,metadata) values(p_product_id,'ADJUSTMENT'::public.cylinder_transaction_type,abs(p_quantity),v_uid,p_notes,jsonb_build_object('delta',p_quantity));
   if p_quantity>0 then v_released:=public.process_waiting_orders(v_uid); end if;
 elsif p_action in('transfer_driver','transfer_distributor') then
   if p_quantity<=0 then raise exception 'INVALID_QUANTITY'; end if;
   if p_target_party_id is null or p_target_party_type is null then raise exception 'TARGET_PARTY_REQUIRED'; end if;
   update public.products set stock=stock-p_quantity,updated_at=now() where id=p_product_id and stock>=p_quantity returning stock into v_new_stock;
   if not found then raise exception 'INSUFFICIENT_STOCK'; end if;
   insert into public.custody(party_id,party_type,product_id,quantity) values(p_target_party_id,p_target_party_type,p_product_id,p_quantity)
   on conflict(party_id,product_id) do update set quantity=public.custody.quantity+excluded.quantity,updated_at=now();
   insert into public.cylinder_transactions(product_id,transaction_type,quantity,performed_by,to_party_id,notes) values(p_product_id,case when p_action='transfer_driver' then 'TRANSFER_DRIVER'::public.cylinder_transaction_type else 'TRANSFER_DISTRIBUTOR'::public.cylinder_transaction_type end,p_quantity,v_uid,p_target_party_id,p_notes);
 else raise exception 'UNKNOWN_INVENTORY_ACTION'; end if;
 return jsonb_build_object('product_id',p_product_id,'stock',v_new_stock,'waiting_orders_released',v_released);
end $$;
revoke execute on function public.manage_inventory(text,uuid,integer,text,uuid,public.custody_party_type,uuid) from public,anon,authenticated;
grant execute on function public.manage_inventory(text,uuid,integer,text,uuid,public.custody_party_type,uuid) to service_role;
commit;