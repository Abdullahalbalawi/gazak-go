-- Record the distributor who accepts a new order so ownership and notifications remain consistent.
create or replace function public.capture_order_distributor()
returns trigger
language plpgsql
as $$
begin
  if old.status='NEW' and new.status='ACCEPTED' and new.distributor_id is null then
    new.distributor_id := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists orders_capture_distributor on public.orders;
create trigger orders_capture_distributor before update on public.orders
for each row execute function public.capture_order_distributor();
