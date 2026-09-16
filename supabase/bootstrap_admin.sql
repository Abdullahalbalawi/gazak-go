-- Run once in the Supabase SQL Editor after creating the first admin account.
-- Replace the email below with the exact email used for that account.
-- This script is intended for the Supabase SQL Editor (privileged database session), not the browser.

update public.profiles p
set role = 'admin',
    active = true,
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('REPLACE_WITH_ADMIN_EMAIL@example.com');

-- Verify exactly one profile was promoted before using the Admin dashboard.
select p.id, u.email, p.role, p.active
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('REPLACE_WITH_ADMIN_EMAIL@example.com');
