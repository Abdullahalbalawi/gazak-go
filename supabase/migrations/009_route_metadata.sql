-- Conservative route metadata used by Smart Dispatch when no external routing provider is configured.
create or replace function public.set_order_route_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.route_group is null and new.latitude is not null and new.longitude is not null then
    new.route_group := round(new.latitude,2)::text || ':' || round(new.longitude,2)::text;
  end if;
  if new.estimated_delivery_at is null then
    new.estimated_delivery_at := now() + interval '60 minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_route_metadata on public.orders;
create trigger orders_route_metadata before insert on public.orders
for each row execute function public.set_order_route_metadata();
