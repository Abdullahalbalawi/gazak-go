-- Gazak Go - Payment workflow helpers
-- Migration 014: customer payment session placeholder and secure payment-state helpers.
-- Provider-specific SDK/webhook integration should call record_payment_result from a trusted backend.

create or replace function public.start_card_payment(p_order_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_order public.orders%rowtype;
  v_actor public.profiles%rowtype;
  v_invoice public.invoices%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found or v_actor.role <> 'customer' then raise exception 'Active customer required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id <> auth.uid() then raise exception 'Order not found'; end if;
  if v_order.payment_method <> 'CARD' then raise exception 'Order is not configured for card payment'; end if;
  if v_order.payment_status = 'PAID' then raise exception 'Order is already paid'; end if;

  select * into v_invoice from public.invoices where order_id = p_order_id;
  if not found then
    v_invoice := public.ensure_invoice_for_order(p_order_id);
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'amount', v_order.total,
    'currency', 'SAR',
    'status', v_order.payment_status,
    'provider', 'PENDING_PROVIDER_CONFIGURATION'
  );
end;
$$;

create or replace function public.get_order_billing(p_order_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_order public.orders%rowtype;
  v_actor public.profiles%rowtype;
  v_invoice public.invoices%rowtype;
  v_payment public.payment_transactions%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Active profile required'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_actor.role <> 'admin' and v_order.customer_id <> auth.uid() and v_order.driver_id <> auth.uid() and v_order.distributor_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select * into v_invoice from public.invoices where order_id = p_order_id;
  select * into v_payment from public.payment_transactions where order_id = p_order_id order by created_at desc limit 1;

  return jsonb_build_object(
    'order_id', v_order.id,
    'invoice', case when v_invoice.id is null then null else jsonb_build_object(
      'id', v_invoice.id,
      'number', v_invoice.invoice_number,
      'subtotal', v_invoice.subtotal,
      'delivery_fee', v_invoice.delivery_fee,
      'total', v_invoice.total,
      'payment_method', v_invoice.payment_method,
      'payment_status', v_invoice.payment_status,
      'issued_at', v_invoice.issued_at
    ) end,
    'payment', case when v_payment.id is null then null else jsonb_build_object(
      'id', v_payment.id,
      'provider', v_payment.provider,
      'reference', v_payment.provider_reference,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'status', v_payment.status,
      'raw_status', v_payment.raw_status,
      'created_at', v_payment.created_at
    ) end
  );
end;
$$;

revoke all on function public.start_card_payment(uuid) from public;
revoke all on function public.get_order_billing(uuid) from public;
grant execute on function public.start_card_payment(uuid) to authenticated;
grant execute on function public.get_order_billing(uuid) to authenticated;
