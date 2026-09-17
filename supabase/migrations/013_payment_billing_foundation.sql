-- Gazak Go - Payment & billing foundation
-- Migration 013: payment transaction audit, invoice numbering, and payment-state RPC.

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  status public.payment_status not null default 'PENDING',
  raw_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_transactions_provider_reference_uidx
  on public.payment_transactions(provider, provider_reference)
  where provider_reference is not null;
create index if not exists payment_transactions_order_idx
  on public.payment_transactions(order_id, created_at desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  invoice_number text not null unique,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'PENDING',
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.invoice_number_seq;

create or replace function public.set_payment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at
before update on public.payment_transactions
for each row execute function public.set_payment_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_payment_updated_at();

alter table public.payment_transactions enable row level security;
alter table public.invoices enable row level security;

create policy payment_transactions_select_related on public.payment_transactions
for select using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.customer_id = auth.uid() or o.driver_id = auth.uid() or o.distributor_id = auth.uid())
  )
);

create policy invoices_select_related on public.invoices
for select using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.customer_id = auth.uid() or o.driver_id = auth.uid() or o.distributor_id = auth.uid())
  )
);

revoke insert, update, delete on public.payment_transactions from anon, authenticated;
revoke insert, update, delete on public.invoices from anon, authenticated;

create or replace function public.ensure_invoice_for_order(p_order_id uuid)
returns public.invoices
security definer
set search_path = public
language plpgsql
as $$
declare
  v_actor public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_invoice public.invoices%rowtype;
  v_number text;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Active profile required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_actor.role <> 'admin' and v_order.customer_id <> auth.uid() and v_order.driver_id <> auth.uid() and v_order.distributor_id <> auth.uid() then
    raise exception 'Not authorized to access this order';
  end if;

  select * into v_invoice from public.invoices where order_id = p_order_id;
  if found then return v_invoice; end if;

  v_number := 'GG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 8, '0');
  insert into public.invoices(order_id, invoice_number, subtotal, delivery_fee, total, payment_method, payment_status)
  values(v_order.id, v_number, v_order.subtotal, v_order.delivery_fee, v_order.total, v_order.payment_method, v_order.payment_status)
  returning * into v_invoice;
  return v_invoice;
end;
$$;

create or replace function public.record_payment_result(
  p_order_id uuid,
  p_provider text,
  p_provider_reference text,
  p_amount numeric,
  p_status public.payment_status,
  p_raw_status text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.payment_transactions
security definer
set search_path = public
language plpgsql
as $$
declare
  v_actor public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payment_transactions%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found or v_actor.role <> 'admin' then raise exception 'Admin permission required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_amount <> v_order.total then raise exception 'Payment amount does not match order total'; end if;
  if p_provider is null or trim(p_provider) = '' then raise exception 'Payment provider is required'; end if;

  insert into public.payment_transactions(order_id, provider, provider_reference, amount, status, raw_status, metadata)
  values(p_order_id, trim(p_provider), nullif(trim(p_provider_reference), ''), p_amount, p_status, p_raw_status, coalesce(p_metadata, '{}'::jsonb))
  on conflict (provider, provider_reference) where provider_reference is not null
  do update set amount = excluded.amount,
                status = excluded.status,
                raw_status = excluded.raw_status,
                metadata = excluded.metadata,
                updated_at = now()
  returning * into v_payment;

  update public.orders
  set payment_status = p_status, updated_at = now()
  where id = p_order_id;

  update public.invoices
  set payment_status = p_status, updated_at = now()
  where order_id = p_order_id;

  return v_payment;
end;
$$;

revoke all on function public.ensure_invoice_for_order(uuid) from public;
revoke all on function public.record_payment_result(uuid,text,text,numeric,public.payment_status,text,jsonb) from public;
grant execute on function public.ensure_invoice_for_order(uuid) to authenticated;
grant execute on function public.record_payment_result(uuid,text,text,numeric,public.payment_status,text,jsonb) to authenticated;

-- Ensure a new paid cash order still gets a billing record when requested explicitly by the UI.
