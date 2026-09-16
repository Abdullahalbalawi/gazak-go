-- Gazak Go - Transactional order workflows
-- Migration 002: create-order and status transitions with inventory protection.

create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_payment_method public.payment_method,
  p_items jsonb,
  p_delivery_fee numeric default 0,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
security definer
set search_path = public
language plpgsql
as $$
declare
  v_order_id uuid; v_subtotal numeric(12,2) := 0; v_item jsonb;
  v_product public.products%rowtype; v_qty integer; v_price numeric(12,2);
  v_customer public.profiles%rowtype;
begin
  select * into v_customer from public.profiles where id = auth.uid() and active = true;
  if not found or v_customer.role <> 'customer' then raise exception 'Only active customers can create orders'; end if;
  if coalesce(trim(p_address), '') = '' then raise exception 'Address is required'; end if;
  if p_delivery_fee < 0 then raise exception 'Invalid delivery fee'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order must contain items'; end if;

  insert into public.orders (customer_id, customer_name, customer_phone, status, subtotal, delivery_fee, total, payment_method, address, latitude, longitude)
  values (auth.uid(), p_customer_name, p_customer_phone, 'NEW', 0, p_delivery_fee, p_delivery_fee, p_payment_method, p_address, p_latitude, p_longitude)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid item quantity'; end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and status = 'ACTIVE' for update;
    if not found then raise exception 'Product is unavailable'; end if;
    v_price := v_product.price;
    update public.products set stock = stock - v_qty, reserved_stock = reserved_stock + v_qty, updated_at = now()
    where id = v_product.id and stock >= v_qty;
    if not found then raise exception 'Insufficient stock for product %', v_product.name; end if;
    insert into public.order_items(order_id, product_id, product_name, quantity, price, cylinder_type)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_price, v_product.cylinder_type);
    insert into public.cylinder_transactions(type, product_id, product_name, quantity, order_id, performed_by, performed_by_name, performed_by_role)
    values ('RESERVE', v_product.id, v_product.name, v_qty, v_order_id, auth.uid(), v_customer.full_name, v_customer.role);
    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal + p_delivery_fee where id = v_order_id;
  insert into public.order_history(order_id, previous_status, new_status, performed_by, performed_by_name, performed_by_role, customer_id, note)
  values (v_order_id, null, 'NEW', auth.uid(), v_customer.full_name, v_customer.role, auth.uid(), 'Order created');
  insert into public.notifications(user_id, title, body, order_id, type)
  select p.id, 'طلب جديد', 'تم إنشاء طلب جديد ويحتاج إلى المعالجة.', v_order_id, 'order_created'
  from public.profiles p where p.role = 'distributor' and p.active = true;
  return v_order_id;
end;
$$;

create or replace function public.transition_order(p_order_id uuid, p_new_status public.order_status, p_note text default null)
returns public.orders
security definer
set search_path = public
language plpgsql
as $$
declare
  v_order public.orders%rowtype; v_actor public.profiles%rowtype; v_busy integer;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Active profile required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if not ((v_order.status = 'NEW' and p_new_status in ('ACCEPTED','CANCELLED')) or
          (v_order.status = 'ACCEPTED' and p_new_status in ('PREPARING','CANCELLED')) or
          (v_order.status = 'PREPARING' and p_new_status in ('READY','CANCELLED')) or
          (v_order.status = 'READY' and p_new_status in ('ASSIGNED','CANCELLED')) or
          (v_order.status = 'ASSIGNED' and p_new_status in ('OUT_FOR_DELIVERY','CANCELLED')) or
          (v_order.status = 'OUT_FOR_DELIVERY' and p_new_status in ('ARRIVED','CANCELLED')) or
          (v_order.status = 'ARRIVED' and p_new_status in ('DELIVERED','CANCELLED'))) then
    raise exception 'Invalid order status transition';
  end if;

  if p_new_status = 'ASSIGNED' then
    if v_actor.role not in ('admin','distributor') then raise exception 'Only admin or distributor can assign orders'; end if;
    if v_order.driver_id is null then raise exception 'A driver must be selected before assignment'; end if;
    select count(*) into v_busy from public.orders o where o.driver_id = v_order.driver_id and o.id <> v_order.id and o.status in ('ASSIGNED','OUT_FOR_DELIVERY','ARRIVED');
    if v_busy > 0 then raise exception 'Driver already has an ongoing order'; end if;
  elsif p_new_status in ('ACCEPTED','PREPARING','READY') then
    if v_actor.role not in ('admin','distributor') then raise exception 'Distributor or admin required'; end if;
  elsif p_new_status in ('OUT_FOR_DELIVERY','ARRIVED','DELIVERED') then
    if v_actor.role not in ('admin','driver') then raise exception 'Driver or admin required'; end if;
    if v_actor.role = 'driver' and v_order.driver_id <> auth.uid() then raise exception 'Driver is not assigned to this order'; end if;
  elsif p_new_status = 'CANCELLED' then
    if v_actor.role <> 'admin' and v_order.customer_id <> auth.uid() then raise exception 'Not authorized to cancel this order'; end if;
  end if;

  update public.orders set status = p_new_status, assigned_at = case when p_new_status = 'ASSIGNED' then coalesce(assigned_at, now()) else assigned_at end, updated_at = now() where id = v_order.id;

  if p_new_status = 'DELIVERED' then
    update public.products p set reserved_stock = p.reserved_stock - x.qty, sold_stock = p.sold_stock + x.qty, updated_at = now()
    from (select product_id, sum(quantity)::integer qty from public.order_items where order_id = v_order.id group by product_id) x
    where p.id = x.product_id and p.reserved_stock >= x.qty;
    insert into public.cylinder_transactions(type, product_id, product_name, quantity, order_id, performed_by, performed_by_name, performed_by_role)
    select 'SALE', oi.product_id, oi.product_name, sum(oi.quantity)::integer, v_order.id, auth.uid(), v_actor.full_name, v_actor.role
    from public.order_items oi where oi.order_id = v_order.id group by oi.product_id, oi.product_name;
  elsif p_new_status = 'CANCELLED' and v_order.status not in ('DELIVERED','CANCELLED') then
    update public.products p set stock = p.stock + x.qty, reserved_stock = p.reserved_stock - x.qty, updated_at = now()
    from (select product_id, sum(quantity)::integer qty from public.order_items where order_id = v_order.id group by product_id) x
    where p.id = x.product_id and p.reserved_stock >= x.qty;
    insert into public.cylinder_transactions(type, product_id, product_name, quantity, order_id, performed_by, performed_by_name, performed_by_role)
    select 'RELEASE', oi.product_id, oi.product_name, sum(oi.quantity)::integer, v_order.id, auth.uid(), v_actor.full_name, v_actor.role
    from public.order_items oi where oi.order_id = v_order.id group by oi.product_id, oi.product_name;
  end if;

  insert into public.order_history(order_id, previous_status, new_status, performed_by, performed_by_name, performed_by_role, customer_id, driver_id, distributor_id, note)
  values (v_order.id, v_order.status, p_new_status, auth.uid(), v_actor.full_name, v_actor.role, v_order.customer_id, v_order.driver_id, v_order.distributor_id, p_note);
  insert into public.notifications(user_id, title, body, order_id, type)
  select distinct p.id, 'تحديث الطلب', 'تم تحديث حالة الطلب إلى ' || p_new_status::text, v_order.id, 'order_status'
  from public.profiles p where p.id in (v_order.customer_id, v_order.driver_id, v_order.distributor_id) and p.id is not null and p.id <> auth.uid();
  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end;
$$;

revoke all on function public.create_order(text,text,text,public.payment_method,jsonb,numeric,numeric,numeric) from public;
revoke all on function public.transition_order(uuid,public.order_status,text) from public;
grant execute on function public.create_order(text,text,text,public.payment_method,jsonb,numeric,numeric,numeric) to authenticated;
grant execute on function public.transition_order(uuid,public.order_status,text) to authenticated;
