-- Prevent users from changing their own role/active flag through direct table updates.
create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns public.profiles
security definer
set search_path = public
language plpgsql
as $$
declare v public.profiles%rowtype;
begin
  update public.profiles set full_name=coalesce(nullif(trim(p_full_name),''),full_name), phone=coalesce(nullif(trim(p_phone),''),phone), updated_at=now() where id=auth.uid() and active=true returning * into v;
  if not found then raise exception 'Active profile required'; end if;
  return v;
end;
$$;

revoke all on function public.update_my_profile(text,text) from public;
grant execute on function public.update_my_profile(text,text) to authenticated;

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_admin_only on public.profiles
for update using (public.is_admin()) with check (public.is_admin());
