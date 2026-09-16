-- Gazak Go - Initial Supabase schema
-- Migration 001: authentication, catalog, orders, inventory, notifications and audit trail.
-- Apply this migration to a fresh Supabase project.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'distributor', 'driver', 'admin');
create type public.product_status as enum ('ACTIVE', 'INACTIVE');
create type public.cylinder_type as enum ('new', 'exchange');
create type public.order_status as enum (
  'NEW', 'ACCEPTED', 'PREPARING', 'READY', 'ASSIGNED',
  'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED', 'CANCELLED'
);
create type public.payment_method as enum ('CASH', 'CARD');
create type public.payment_status as enum ('PENDING', 'PAID');
create type public.transaction_type as enum (
  'RESTOCK', 'SALE', 'RETURN', 'EXCHANGE', 'TRANSFER_DISTRIBUTOR',
  'TRANSFER_DRIVER', 'ADJUSTMENT', 'RESERVE', 'RELEASE'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  image text,
  stock integer not null default 0 check (stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  sold_stock integer not null default 0 check (sold_stock >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  status public.product_status not null default 'ACTIVE',
  cylinder_type public.cylinder_type not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  customer_name text not null,
  customer_phone text not null,
  distributor_id uuid references public.profiles(id),
  driver_id uuid references public.profiles(id),
  status public.order_status not null default 'NEW',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'PENDING',
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  return_count integer not null default 0 check (return_count >= 0),
  assigned_at timestamptz,
  estimated_delivery_at timestamptz,
  route_group text,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  total numeric(12,2) generated always as (quantity * price) stored,
  cylinder_type public.cylinder_type not null,
  created_at timestamptz not null default now()
);

create table public.order_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status public.order_status,
  new_status public.order_status not null,
  performed_by uuid references public.profiles(id),
  performed_by_name text,
  performed_by_role public.app_role,
  customer_id uuid references public.profiles(id),
  driver_id uuid references public.profiles(id),
  distributor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  order_id uuid references public.orders(id) on delete cascade,
  type text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.custody (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  user_role public.app_role not null check (user_role in ('distributor', 'driver')),
  product_id uuid not null references public.products(id),
  product_name text,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table public.cylinder_transactions (
  id uuid primary key default gen_random_uuid(),
  type public.transaction_type not null,
  product_id uuid not null references public.products(id),
  product_name text,
  quantity integer not null check (quantity > 0),
  counterparty_id uuid references public.profiles(id),
  counterparty_name text,
  counterparty_role public.app_role,
  order_id uuid references public.orders(id),
  performed_by uuid references public.profiles(id),
  performed_by_name text,
  performed_by_role public.app_role,
  note text,
  created_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders(customer_id);
create index orders_driver_status_idx on public.orders(driver_id, status);
create index orders_distributor_status_idx on public.orders(distributor_id, status);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_history_order_id_created_idx on public.order_history(order_id, created_at desc);
create index notifications_user_read_created_idx on public.notifications(user_id, read, created_at desc);
create index custody_user_product_idx on public.custody(user_id, product_id);
create index cylinder_transactions_product_created_idx on public.cylinder_transactions(product_id, created_at desc);
create index cylinder_transactions_order_idx on public.cylinder_transactions(order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger custody_set_updated_at before update on public.custody
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
stable
security definer
set search_path = public
language sql
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.reserve_stock(p_product_id uuid, p_quantity integer, p_order_id uuid default null)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  update public.products
  set stock = stock - p_quantity,
      reserved_stock = reserved_stock + p_quantity,
      updated_at = now()
  where id = p_product_id
    and status = 'ACTIVE'
    and stock >= p_quantity;

  if not found then
    raise exception 'Insufficient stock for product %', p_product_id;
  end if;

  insert into public.cylinder_transactions (type, product_id, quantity, order_id, performed_by)
  values ('RESERVE', p_product_id, p_quantity, p_order_id, auth.uid());
end;
$$;

create or replace function public.release_stock(p_product_id uuid, p_quantity integer, p_order_id uuid default null)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  update public.products
  set stock = stock + p_quantity,
      reserved_stock = reserved_stock - p_quantity,
      updated_at = now()
  where id = p_product_id
    and reserved_stock >= p_quantity;

  if not found then
    raise exception 'Invalid reserved stock release for product %', p_product_id;
  end if;

  insert into public.cylinder_transactions (type, product_id, quantity, order_id, performed_by)
  values ('RELEASE', p_product_id, p_quantity, p_order_id, auth.uid());
end;
$$;

create or replace function public.consume_stock(p_product_id uuid, p_quantity integer, p_order_id uuid default null)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  update public.products
  set reserved_stock = reserved_stock - p_quantity,
      sold_stock = sold_stock + p_quantity,
      updated_at = now()
  where id = p_product_id
    and reserved_stock >= p_quantity;

  if not found then
    raise exception 'Invalid reserved stock consumption for product %', p_product_id;
  end if;

  insert into public.cylinder_transactions (type, product_id, quantity, order_id, performed_by)
  values ('SALE', p_product_id, p_quantity, p_order_id, auth.uid());
end;
$$;

-- RLS: users may see their own profile; admins may manage all profiles.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_history enable row level security;
alter table public.notifications enable row level security;
alter table public.custody enable row level security;
alter table public.cylinder_transactions enable row level security;

create policy profiles_select_self_or_admin on public.profiles
for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles
for insert with check (public.is_admin());
create policy profiles_admin_delete on public.profiles
for delete using (public.is_admin());

create policy products_public_active_or_admin on public.products
for select using (status = 'ACTIVE' or public.is_admin());
create policy products_admin_insert on public.products
for insert with check (public.is_admin());
create policy products_admin_update on public.products
for update using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products
for delete using (public.is_admin());

create policy orders_select_related on public.orders
for select using (
  public.is_admin()
  or customer_id = auth.uid()
  or driver_id = auth.uid()
  or distributor_id = auth.uid()
  or (status = 'NEW' and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'distributor' and p.active = true
  ))
);
create policy orders_customer_insert on public.orders
for insert with check (customer_id = auth.uid());
create policy orders_related_update on public.orders
for update using (
  public.is_admin() or customer_id = auth.uid() or driver_id = auth.uid() or distributor_id = auth.uid()
) with check (
  public.is_admin() or customer_id = auth.uid() or driver_id = auth.uid() or distributor_id = auth.uid()
);
create policy orders_admin_delete on public.orders
for delete using (public.is_admin());

create policy order_items_select_related on public.order_items
for select using (exists (
  select 1 from public.orders o
  where o.id = order_id
    and (public.is_admin() or o.customer_id = auth.uid() or o.driver_id = auth.uid() or o.distributor_id = auth.uid())
));
create policy order_items_insert_customer on public.order_items
for insert with check (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy order_items_admin_update on public.order_items
for update using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin_delete on public.order_items
for delete using (public.is_admin());

create policy history_select_related on public.order_history
for select using (
  public.is_admin()
  or performed_by = auth.uid()
  or customer_id = auth.uid()
  or driver_id = auth.uid()
  or distributor_id = auth.uid()
);

create policy notifications_select_own_or_admin on public.notifications
for select using (user_id = auth.uid() or public.is_admin());
create policy notifications_update_own_or_admin on public.notifications
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy custody_select_own_or_admin on public.custody
for select using (user_id = auth.uid() or public.is_admin());
create policy transactions_select_authorized on public.cylinder_transactions
for select using (
  public.is_admin()
  or counterparty_id = auth.uid()
  or performed_by = auth.uid()
);

-- Direct inserts/updates to history, notifications, custody and transactions are intentionally restricted.
-- Trusted server-side functions should perform those operations.
revoke insert, update, delete on public.order_history from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
revoke insert, update, delete on public.custody from anon, authenticated;
revoke insert, update, delete on public.cylinder_transactions from anon, authenticated;

-- RPC functions run with controlled privileges and are the preferred path for inventory mutations.
revoke all on function public.reserve_stock(uuid, integer, uuid) from public;
revoke all on function public.release_stock(uuid, integer, uuid) from public;
revoke all on function public.consume_stock(uuid, integer, uuid) from public;
grant execute on function public.reserve_stock(uuid, integer, uuid) to authenticated;
grant execute on function public.release_stock(uuid, integer, uuid) to authenticated;
grant execute on function public.consume_stock(uuid, integer, uuid) to authenticated;
