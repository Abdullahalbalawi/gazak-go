-- Inventory transfer rules for admin and distributor custody.
create or replace function public.transfer_inventory_to_driver(p_product_id uuid,p_driver_id uuid,p_quantity integer,p_note text default null)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare a public.profiles%rowtype; d public.profiles%rowtype; p public.products%rowtype; c public.custody%rowtype;
begin
 select * into a from public.profiles where id=auth.uid() and active=true;
 select * into d from public.profiles where id=p_driver_id and role='driver' and active=true;
 select * into p from public.products where id=p_product_id for update;
 if not found or d.id is null then raise exception 'Invalid actor, driver or product'; end if;
 if p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
 if a.role='admin' then
   if p.stock<p_quantity then raise exception 'Insufficient main stock'; end if;
   update public.products set stock=stock-p_quantity,updated_at=now() where id=p.id;
 elsif a.role='distributor' then
   select * into c from public.custody where user_id=a.id and product_id=p.id for update;
   if not found or c.quantity<p_quantity then raise exception 'Insufficient distributor custody'; end if;
   update public.custody set quantity=quantity-p_quantity,updated_at=now() where id=c.id;
 else raise exception 'Admin or distributor required'; end if;
 insert into public.custody(user_id,user_name,user_role,product_id,product_name,quantity) values(d.id,d.full_name,d.role,p.id,p.name,p_quantity)
 on conflict(user_id,product_id) do update set quantity=public.custody.quantity+excluded.quantity,updated_at=now();
 insert into public.cylinder_transactions(type,product_id,product_name,quantity,counterparty_id,counterparty_name,counterparty_role,performed_by,performed_by_name,performed_by_role,note)
 values('TRANSFER_DRIVER',p.id,p.name,p_quantity,d.id,d.full_name,d.role,a.id,a.full_name,a.role,p_note);
end;
$$;
revoke all on function public.transfer_inventory_to_driver(uuid,uuid,integer,text) from public;
grant execute on function public.transfer_inventory_to_driver(uuid,uuid,integer,text) to authenticated;
