begin;
drop function if exists public.update_profile_self(text,text);
drop function if exists public.update_customer_order_details(uuid,jsonb,numeric,numeric,timestamptz,text);
drop function if exists public.mark_notification_read(uuid,boolean);
commit;