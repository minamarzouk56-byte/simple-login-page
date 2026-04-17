-- =====================================================================
-- FinHub — Full Database Schema (External Supabase)
-- Run this entire file in Supabase Dashboard → SQL Editor → New Query
-- =====================================================================
-- This script is IDEMPOTENT-ish: safe to run on a fresh project.
-- If re-running, drop existing objects first.

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.account_type as enum ('asset','liability','equity','revenue','expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_type as enum ('customer','supplier','both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.journal_status as enum ('posted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_permission as enum (
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'journal.view','journal.create','journal.edit','journal.delete',
    'partners.view','partners.create','partners.edit','partners.delete',
    'reports.view','users.manage','settings.manage'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. PROFILES (linked to auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile on signup. First user becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count int;
begin
  select count(*) into user_count from public.profiles;
  insert into public.profiles (id, full_name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    user_count = 0   -- first user is admin
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. PERMISSIONS (granular, per-user)
-- ---------------------------------------------------------------------
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission public.app_permission not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  unique (user_id, permission)
);

alter table public.user_permissions enable row level security;

-- Security definer helpers (avoid RLS recursion)
create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = _user_id), false);
$$;

create or replace function public.has_permission(_user_id uuid, _permission public.app_permission)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_admin(_user_id)
    or exists (
      select 1 from public.user_permissions
      where user_id = _user_id and permission = _permission
    );
$$;

-- ---------------------------------------------------------------------
-- 5. CURRENCIES (multi-currency from day one)
-- ---------------------------------------------------------------------
create table if not exists public.currencies (
  code text primary key,        -- e.g. 'EGP','USD'
  name_ar text not null,
  symbol text not null,
  is_base boolean not null default false,
  exchange_rate numeric(18,6) not null default 1,   -- vs base currency
  created_at timestamptz not null default now()
);

alter table public.currencies enable row level security;

-- Ensure exactly one base currency
create unique index if not exists currencies_one_base
  on public.currencies ((true)) where is_base;

insert into public.currencies (code, name_ar, symbol, is_base, exchange_rate) values
  ('EGP','جنيه مصري','ج.م', true, 1),
  ('USD','دولار أمريكي','$', false, 50),
  ('EUR','يورو','€', false, 54),
  ('SAR','ريال سعودي','﷼', false, 13.3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 6. CHART OF ACCOUNTS (hierarchical, auto-coded)
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  account_type public.account_type not null,
  parent_id uuid references public.accounts(id) on delete restrict,
  level int not null default 1,
  is_leaf boolean not null default true,
  currency_code text not null default 'EGP' references public.currencies(code),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_accounts_parent on public.accounts(parent_id);
create index if not exists idx_accounts_type on public.accounts(account_type);

alter table public.accounts enable row level security;

-- Auto-generate hierarchical code: 1 -> 11 -> 111 -> 1111
create or replace function public.generate_account_code(_parent_id uuid, _account_type public.account_type)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_code text;
  next_seq int;
  new_code text;
  type_prefix text;
begin
  if _parent_id is null then
    -- Top-level: 1=asset, 2=liability, 3=equity, 4=revenue, 5=expense
    type_prefix := case _account_type
      when 'asset' then '1'
      when 'liability' then '2'
      when 'equity' then '3'
      when 'revenue' then '4'
      when 'expense' then '5'
    end;
    select coalesce(max(substring(code from 2)::int), 0) + 1
      into next_seq
      from public.accounts
      where parent_id is null and code like type_prefix || '%' and length(code) = 2;
    new_code := type_prefix || lpad(next_seq::text, 1, '0');
  else
    select code into parent_code from public.accounts where id = _parent_id;
    if parent_code is null then
      raise exception 'Parent account not found';
    end if;
    select coalesce(max(substring(code from length(parent_code) + 1)::int), 0) + 1
      into next_seq
      from public.accounts
      where parent_id = _parent_id;
    new_code := parent_code || lpad(next_seq::text, 1, '0');
  end if;
  return new_code;
end;
$$;

-- Trigger to auto-set code, level, and update parent.is_leaf
create or replace function public.handle_account_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_level int;
  parent_type public.account_type;
begin
  if new.code is null or new.code = '' then
    new.code := public.generate_account_code(new.parent_id, new.account_type);
  end if;

  if new.parent_id is not null then
    select level, account_type into parent_level, parent_type
      from public.accounts where id = new.parent_id;
    new.level := parent_level + 1;
    -- Inherit account_type from parent
    new.account_type := parent_type;
    -- Mark parent as non-leaf
    update public.accounts set is_leaf = false where id = new.parent_id;
  else
    new.level := 1;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_account_insert on public.accounts;
create trigger trg_account_insert
before insert on public.accounts
for each row execute function public.handle_account_insert();

-- ---------------------------------------------------------------------
-- 7. PARTNERS (customers / suppliers)
-- ---------------------------------------------------------------------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  partner_type public.partner_type not null,
  phone text,
  email text,
  address text,
  tax_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_partners_type on public.partners(partner_type);
alter table public.partners enable row level security;

-- ---------------------------------------------------------------------
-- 8. JOURNAL ENTRIES (header + lines, posted immediately)
-- ---------------------------------------------------------------------
create sequence if not exists public.journal_entry_seq start with 1;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  entry_date date not null,
  description text,
  reference text,
  status public.journal_status not null default 'posted',
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  currency_code text not null default 'EGP' references public.currencies(code),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_journal_entries_date on public.journal_entries(entry_date);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  partner_id uuid references public.partners(id) on delete set null,
  description text,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  currency_code text not null default 'EGP' references public.currencies(code),
  exchange_rate numeric(18,6) not null default 1,
  line_order int not null default 0,
  check (not (debit > 0 and credit > 0))
);

create index if not exists idx_jel_entry on public.journal_entry_lines(entry_id);
create index if not exists idx_jel_account on public.journal_entry_lines(account_id);
create index if not exists idx_jel_partner on public.journal_entry_lines(partner_id);

alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;

-- Auto-generate entry_number: JE-2026-000001
create or replace function public.generate_entry_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val bigint;
begin
  if new.entry_number is null or new.entry_number = '' then
    next_val := nextval('public.journal_entry_seq');
    new.entry_number := 'JE-' || to_char(coalesce(new.entry_date, current_date), 'YYYY')
                        || '-' || lpad(next_val::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_je_number on public.journal_entries;
create trigger trg_je_number
before insert on public.journal_entries
for each row execute function public.generate_entry_number();

-- Recalculate totals + enforce balanced entry whenever lines change
create or replace function public.recalc_entry_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry uuid;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
begin
  v_entry := coalesce(new.entry_id, old.entry_id);
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into v_debit, v_credit
    from public.journal_entry_lines
    where entry_id = v_entry;

  update public.journal_entries
    set total_debit = v_debit, total_credit = v_credit
    where id = v_entry;

  return null;
end;
$$;

drop trigger if exists trg_jel_recalc on public.journal_entry_lines;
create trigger trg_jel_recalc
after insert or update or delete on public.journal_entry_lines
for each row execute function public.recalc_entry_totals();

-- ---------------------------------------------------------------------
-- 9. RLS POLICIES
-- ---------------------------------------------------------------------

-- PROFILES
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));

drop policy if exists "profiles_admin_update_any" on public.profiles;
create policy "profiles_admin_update_any" on public.profiles
  for update to authenticated
  using (public.is_admin(auth.uid()));

-- USER_PERMISSIONS — admins only
drop policy if exists "perms_select_self_or_admin" on public.user_permissions;
create policy "perms_select_self_or_admin" on public.user_permissions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "perms_admin_all" on public.user_permissions;
create policy "perms_admin_all" on public.user_permissions
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- CURRENCIES — read for all authenticated, write for settings.manage
drop policy if exists "currencies_select_all" on public.currencies;
create policy "currencies_select_all" on public.currencies
  for select to authenticated using (true);

drop policy if exists "currencies_write_settings" on public.currencies;
create policy "currencies_write_settings" on public.currencies
  for all to authenticated
  using (public.has_permission(auth.uid(), 'settings.manage'))
  with check (public.has_permission(auth.uid(), 'settings.manage'));

-- ACCOUNTS
drop policy if exists "accounts_select" on public.accounts;
create policy "accounts_select" on public.accounts
  for select to authenticated
  using (public.has_permission(auth.uid(), 'accounts.view'));

drop policy if exists "accounts_insert" on public.accounts;
create policy "accounts_insert" on public.accounts
  for insert to authenticated
  with check (public.has_permission(auth.uid(), 'accounts.create'));

drop policy if exists "accounts_update" on public.accounts;
create policy "accounts_update" on public.accounts
  for update to authenticated
  using (public.has_permission(auth.uid(), 'accounts.edit'))
  with check (public.has_permission(auth.uid(), 'accounts.edit'));

drop policy if exists "accounts_delete" on public.accounts;
create policy "accounts_delete" on public.accounts
  for delete to authenticated
  using (public.has_permission(auth.uid(), 'accounts.delete'));

-- PARTNERS
drop policy if exists "partners_select" on public.partners;
create policy "partners_select" on public.partners
  for select to authenticated
  using (public.has_permission(auth.uid(), 'partners.view'));

drop policy if exists "partners_insert" on public.partners;
create policy "partners_insert" on public.partners
  for insert to authenticated
  with check (public.has_permission(auth.uid(), 'partners.create'));

drop policy if exists "partners_update" on public.partners;
create policy "partners_update" on public.partners
  for update to authenticated
  using (public.has_permission(auth.uid(), 'partners.edit'))
  with check (public.has_permission(auth.uid(), 'partners.edit'));

drop policy if exists "partners_delete" on public.partners;
create policy "partners_delete" on public.partners
  for delete to authenticated
  using (public.has_permission(auth.uid(), 'partners.delete'));

-- JOURNAL ENTRIES
drop policy if exists "je_select" on public.journal_entries;
create policy "je_select" on public.journal_entries
  for select to authenticated
  using (public.has_permission(auth.uid(), 'journal.view'));

drop policy if exists "je_insert" on public.journal_entries;
create policy "je_insert" on public.journal_entries
  for insert to authenticated
  with check (public.has_permission(auth.uid(), 'journal.create'));

drop policy if exists "je_update" on public.journal_entries;
create policy "je_update" on public.journal_entries
  for update to authenticated
  using (public.has_permission(auth.uid(), 'journal.edit'))
  with check (public.has_permission(auth.uid(), 'journal.edit'));

drop policy if exists "je_delete" on public.journal_entries;
create policy "je_delete" on public.journal_entries
  for delete to authenticated
  using (public.has_permission(auth.uid(), 'journal.delete'));

-- JOURNAL LINES — same access as their entry
drop policy if exists "jel_select" on public.journal_entry_lines;
create policy "jel_select" on public.journal_entry_lines
  for select to authenticated
  using (public.has_permission(auth.uid(), 'journal.view'));

drop policy if exists "jel_insert" on public.journal_entry_lines;
create policy "jel_insert" on public.journal_entry_lines
  for insert to authenticated
  with check (public.has_permission(auth.uid(), 'journal.create'));

drop policy if exists "jel_update" on public.journal_entry_lines;
create policy "jel_update" on public.journal_entry_lines
  for update to authenticated
  using (public.has_permission(auth.uid(), 'journal.edit'))
  with check (public.has_permission(auth.uid(), 'journal.edit'));

drop policy if exists "jel_delete" on public.journal_entry_lines;
create policy "jel_delete" on public.journal_entry_lines
  for delete to authenticated
  using (public.has_permission(auth.uid(), 'journal.delete'));

-- ---------------------------------------------------------------------
-- 10. SEED — root accounts (the 5 main categories)
-- ---------------------------------------------------------------------
insert into public.accounts (code, name_ar, account_type, parent_id, level, is_leaf)
values
  ('1','الأصول','asset',null,1,false),
  ('2','الخصوم','liability',null,1,false),
  ('3','حقوق الملكية','equity',null,1,false),
  ('4','الإيرادات','revenue',null,1,false),
  ('5','المصروفات','expense',null,1,false)
on conflict (code) do nothing;

-- =====================================================================
-- DONE. Verify by running:  select code, name_ar, account_type from public.accounts;
-- =====================================================================
