-- Gazak Go - Automatic invoice creation
-- Migration 015: create an invoice record whenever a new order is created.

create or replace function public.create_invoice_after_order()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.invoices(order_id, invoice_number, subtotal, delivery_fee, total, payment_method, payment_status)
  values(
    new.id,
    'GG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 8, '0'),
    new.subtotal,
    new.delivery_fee,
    new.total,
    new.payment_method,
    new.payment_status
  )
  on conflict (order_id) do nothing;
  return new;
end;
$$;

drop trigger if exists orders_auto_invoice on public.orders;
create trigger orders_auto_invoice
after insert on public.orders
for each row execute function public.create_invoice_after_order();
