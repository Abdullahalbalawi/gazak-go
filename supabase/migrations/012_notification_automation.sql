-- Gazak Go - Notification automation
-- Migration 012: notify active admins when stock crosses the low-stock threshold or reaches zero.
-- Order lifecycle and Smart Dispatch notifications remain emitted by their transactional RPCs.

create or replace function public.notify_inventory_thresholds()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_title text;
  v_body text;
  v_type text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.stock > 0 and new.stock = 0 then
    v_title := 'نفد المخزون';
    v_body := 'نفد مخزون المنتج: ' || new.name || '.';
    v_type := 'inventory_out_of_stock';
  elsif old.stock > new.low_stock_threshold and new.stock <= new.low_stock_threshold then
    v_title := 'تنبيه مخزون منخفض';
    v_body := 'المخزون منخفض للمنتج: ' || new.name || '. الكمية المتاحة: ' || new.stock::text || '.';
    v_type := 'inventory_low_stock';
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, type)
  select p.id, v_title, v_body, v_type
  from public.profiles p
  where p.role = 'admin' and p.active = true;

  return new;
end;
$$;

drop trigger if exists products_inventory_threshold_notifications on public.products;
create trigger products_inventory_threshold_notifications
after update of stock on public.products
for each row execute function public.notify_inventory_thresholds();
