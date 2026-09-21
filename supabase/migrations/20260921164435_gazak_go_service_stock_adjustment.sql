-- Service-only stock adjustment used by the return/exchange Edge Function.
CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id uuid,p_delta integer)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$
  update public.products
  set stock=stock+p_delta,updated_at=now()
  where id=p_product_id and stock+p_delta>=0
  returning stock;
$$;
revoke execute on function public.adjust_product_stock(uuid,integer) from public,anon,authenticated;
grant execute on function public.adjust_product_stock(uuid,integer) to service_role;
