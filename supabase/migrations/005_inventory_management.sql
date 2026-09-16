-- Gazak Go - Inventory management
create or replace function public.manage_inventory(
  p_action text,
  p_product_id uuid,
  p_quantity integer,
  p_target_user_id uuid default null,
  p_note text default null
)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare
  v_actor public.profiles%rowtype; v_product public.products%rowtype; v_target public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id=auth.uid() and active=true;
  if not found or v_actor.role <> 'admin' then raise exception 'Admin permission required'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p_action='RESTOCK' then
    update public.products set stock=stock+p_quantity, updated_at=now() where id=v_product.id;
  elsif p_action='ADJUSTMENT' then
    update public.products set stock=p_quantity, updated_at=now() where id=v_product.id;
  elsif p_action in ('TRANSFER_DISTRIBUTOR','TRANSFER_DRIVER') then
    select * into v_target from public.profiles where id=p_target_user_id and active=true;
    if not found or (p_action='TRANSFER_DISTRIBUTOR' and v_target.role<>'distributor') or (p_action='TRANSFER_DRIVER' and v_target.role<>'driver') then raise exception 'Invalid target user'; end if;
    if v_product.stock < p_quantity then raise exception 'Insufficient main stock'; end if;
    update public.products set stock=stock-p_quantity, updated_at=now() where id=v_product.id;
    insert into public.custody(user_id,user_name,user_role,product_id,product_name,quantity)
    values(v_target.id,v_target.full_name,v_target.role,v_product.id,v_product.name,p_quantity)
    on conflict(user_id,product_id) do update set quantity=public.custody.quantity+excluded.quantity,updated_at=now();
  else raise exception 'Unsupported inventory action'; end if;
  insert into public.cylinder_transactions(type,product_id,product_name,quantity,counterparty_id,counterparty_name,counterparty_role,performed_by,performed_by_name,performed_by_role,note)
  values(p_action::public.transaction_type,v_product.id,v_product.name,p_quantity,p_target_user_id,v_target.full_name,case when v_target.id is null then null else v_target.role end,auth.uid(),v_actor.full_name,v_actor.role,p_note);
end;
$$;
revoke all on function public.manage_inventory(text,uuid,integer,uuid,text) from public;
grant execute on function public.manage_inventory(text,uuid,integer,uuid,text) to authenticated;
