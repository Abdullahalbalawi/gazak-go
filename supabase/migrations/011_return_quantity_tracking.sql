-- Gazak Go - Prevent duplicate/over returns
-- Track returned quantity per order item so repeated return operations cannot
-- exceed the quantity originally delivered.

alter table public.order_items
  add column if not exists returned_quantity integer not null default 0;

alter table public.order_items
  drop constraint if exists order_items_returned_quantity_check;

alter table public.order_items
  add constraint order_items_returned_quantity_check
  check (returned_quantity >= 0 and returned_quantity <= quantity);

create or replace function public.process_return_exchange(
  p_order_id uuid,
  p_action text,
  p_items jsonb,
  p_new_items jsonb default '[]'::jsonb,
  p_note text default null
)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare
  v_actor public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_new jsonb;
  v_product public.products%rowtype;
  v_order_item public.order_items%rowtype;
  v_qty integer;
  v_total_return integer := 0;
begin
  select * into v_actor
  from public.profiles
  where id = auth.uid() and active = true;
  if not found or v_actor.role not in ('admin','driver') then
    raise exception 'Only admin or driver can process returns';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'DELIVERED' then
    raise exception 'Only delivered orders can be returned or exchanged';
  end if;
  if v_actor.role = 'driver' and v_order.driver_id <> auth.uid() then
    raise exception 'Driver is not assigned to this order';
  end if;
  if p_action not in ('return','exchange') then
    raise exception 'Invalid return/exchange action';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Return items are required';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid return quantity';
    end if;

    select * into v_order_item
    from public.order_items
    where order_id = v_order.id
      and product_id = (v_item->>'product_id')::uuid
    for update;
    if not found then raise exception 'Product was not part of this order'; end if;
    if v_order_item.returned_quantity + v_qty > v_order_item.quantity then
      raise exception 'Return quantity exceeds the remaining delivered quantity';
    end if;

    select * into v_product
    from public.products
    where id = v_order_item.product_id
    for update;
    if not found then raise exception 'Product not found'; end if;

    update public.order_items
    set returned_quantity = returned_quantity + v_qty
    where id = v_order_item.id;

    if v_actor.role = 'driver' then
      insert into public.custody(user_id,user_name,user_role,product_id,product_name,quantity)
      values(auth.uid(), v_actor.full_name, v_actor.role, v_product.id, v_product.name, v_qty)
      on conflict (user_id, product_id) do update
      set quantity = public.custody.quantity + excluded.quantity,
          updated_at = now();
    else
      update public.products
      set stock = stock + v_qty, updated_at = now()
      where id = v_product.id;
    end if;

    insert into public.cylinder_transactions(
      type, product_id, product_name, quantity, counterparty_id,
      counterparty_name, counterparty_role, order_id, performed_by,
      performed_by_name, performed_by_role, note
    )
    values (
      'RETURN', v_product.id, v_product.name, v_qty, v_order.customer_id,
      v_order.customer_name, 'customer', v_order.id, auth.uid(),
      v_actor.full_name, v_actor.role, p_note
    );

    v_total_return := v_total_return + v_qty;
  end loop;

  if p_action = 'exchange' then
    if jsonb_typeof(p_new_items) <> 'array' or jsonb_array_length(p_new_items) = 0 then
      raise exception 'Replacement items are required';
    end if;

    for v_new in select value from jsonb_array_elements(p_new_items) loop
      v_qty := (v_new->>'quantity')::integer;
      if v_qty is null or v_qty <= 0 then
        raise exception 'Invalid replacement quantity';
      end if;

      select * into v_product
      from public.products
      where id = (v_new->>'product_id')::uuid
        and status = 'ACTIVE'
      for update;
      if not found or v_product.stock < v_qty then
        raise exception 'Insufficient stock for replacement product';
      end if;

      update public.products
      set stock = stock - v_qty,
          sold_stock = sold_stock + v_qty,
          updated_at = now()
      where id = v_product.id;

      insert into public.cylinder_transactions(
        type, product_id, product_name, quantity, counterparty_id,
        counterparty_name, counterparty_role, order_id, performed_by,
        performed_by_name, performed_by_role, note
      )
      values (
        'EXCHANGE', v_product.id, v_product.name, v_qty, v_order.customer_id,
        v_order.customer_name, 'customer', v_order.id, auth.uid(),
        v_actor.full_name, v_actor.role, p_note
      );
    end loop;
  end if;

  update public.orders
  set return_count = return_count + v_total_return,
      updated_at = now()
  where id = v_order.id;

  insert into public.order_history(
    order_id, previous_status, new_status, performed_by, performed_by_name,
    performed_by_role, customer_id, driver_id, distributor_id, note
  )
  values (
    v_order.id, v_order.status, v_order.status, auth.uid(), v_actor.full_name,
    v_actor.role, v_order.customer_id, v_order.driver_id, v_order.distributor_id,
    coalesce(p_note, case when p_action = 'return' then 'Return processed' else 'Exchange processed' end)
  );

  insert into public.notifications(user_id, title, body, order_id, type)
  values (
    v_order.customer_id,
    case when p_action = 'return' then 'تم تسجيل المرتجع' else 'تم تسجيل الاستبدال' end,
    case when p_action = 'return' then 'تم تسجيل الأسطوانات المرتجعة.' else 'تم تسجيل عملية الاستبدال.' end,
    v_order.id,
    'return_exchange'
  );
end;
$$;

revoke all on function public.process_return_exchange(uuid,text,jsonb,jsonb,text) from public;
grant execute on function public.process_return_exchange(uuid,text,jsonb,jsonb,text) to authenticated;
