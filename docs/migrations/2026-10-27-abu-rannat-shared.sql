-- أبو رنات: روابط المشاركة الاختيارية (الخيار ب، 2026-10-27)
-- Applied 2026-10-27 with Safi's approval (see the hardening note at the end).
--
-- Stores only analyses a visitor chose to share. RLS is on with NO policies,
-- so the table is unreachable through the public API; the two SECURITY DEFINER
-- functions below are the only way in, and neither can list rows.

create table if not exists public.abu_rannat_shared (
  token       text primary key check (token ~ '^[A-Za-z0-9_-]{12}$'),
  result      jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '180 days'
);

alter table public.abu_rannat_shared enable row level security;

create or replace function public.abu_rannat_share_create(p_token text, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token !~ '^[A-Za-z0-9_-]{12}$' then
    raise exception 'invalid token';
  end if;
  if pg_column_size(p_result) > 200000 then
    raise exception 'result too large';
  end if;
  insert into public.abu_rannat_shared (token, result) values (p_token, p_result);
end;
$$;

create or replace function public.abu_rannat_share_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select result from public.abu_rannat_shared
  where token = p_token and expires_at > now();
$$;

revoke all on function public.abu_rannat_share_create(text, jsonb) from public;
revoke all on function public.abu_rannat_share_get(text) from public;
grant execute on function public.abu_rannat_share_create(text, jsonb) to anon, authenticated;
grant execute on function public.abu_rannat_share_get(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- APPLIED 2026-10-27 (with Safi's approval), followed by this hardening step:
-- abu_rannat_share_create now takes p_secret and checks its SHA-256 against a
-- hash fixed in the function body. The secret itself lives only in
-- ABU_RANNAT_SHARE_SECRET (.env.local and the hosting environment).
-- To rotate: generate a new secret, set it in both places, and re-create the
-- function with the new hash.
-- drop function if exists public.abu_rannat_share_create(text, jsonb);
-- create or replace function public.abu_rannat_share_create(p_token text, p_result jsonb, p_secret text) ...
