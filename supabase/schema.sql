-- ============================================================================
-- Схема Supabase для приложения учёта сертификатов (ШАҲОДАТНОМА).
-- Выполните этот скрипт один раз в Supabase → SQL Editor.
-- ============================================================================

-- Для gen_random_uuid()
create extension if not exists "pgcrypto";

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),

  -- Печатаемые поля бланка
  cert_number        text,
  from_day           text,
  from_month         text,
  from_year          text,
  to_day             text,
  to_month           text,
  to_year            text,
  service_name       text,
  address            text,
  manager_name       text,
  service_type       text,
  normative_doc      text,
  basis_date_number  text,
  activity_doc       text,
  inspection_body    text,
  special_notes      text,
  signatory          text,
  signature          text,

  -- Дополнительные данные (реестр, не печатаются)
  certificate_number text,
  application_number text,
  plan_number        text,
  inspector          text,
  amount             numeric,

  -- Служебные
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Автообновление updated_at при каждом UPDATE
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_certificates_updated_at on public.certificates;
create trigger trg_certificates_updated_at
  before update on public.certificates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security.
-- Приложение работает с публичным (anon/publishable) ключом. Ниже — открытые
-- политики для внутреннего инструмента. Если нужна аутентификация,
-- замените `using (true)` / `with check (true)` на проверку auth.uid().
-- ----------------------------------------------------------------------------
alter table public.certificates enable row level security;

drop policy if exists "certificates_select" on public.certificates;
drop policy if exists "certificates_insert" on public.certificates;
drop policy if exists "certificates_update" on public.certificates;
drop policy if exists "certificates_delete" on public.certificates;

create policy "certificates_select" on public.certificates for select using (true);
create policy "certificates_insert" on public.certificates for insert with check (true);
create policy "certificates_update" on public.certificates for update using (true) with check (true);
create policy "certificates_delete" on public.certificates for delete using (true);

-- ============================================================================
-- Справочник автозамен (сокращений).
-- Пользователь задаёт короткую форму `short`, которая при вводе в поля бланка
-- автоматически разворачивается в полную `full`.
-- ============================================================================
-- Внимание: `full` — зарезервированное слово SQL, поэтому колонка называется full_text.
create table if not exists public.abbreviations (
  id uuid primary key default gen_random_uuid(),
  short     text not null,
  full_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_abbreviations_updated_at on public.abbreviations;
create trigger trg_abbreviations_updated_at
  before update on public.abbreviations
  for each row execute function public.set_updated_at();

alter table public.abbreviations enable row level security;

drop policy if exists "abbreviations_select" on public.abbreviations;
drop policy if exists "abbreviations_insert" on public.abbreviations;
drop policy if exists "abbreviations_update" on public.abbreviations;
drop policy if exists "abbreviations_delete" on public.abbreviations;

create policy "abbreviations_select" on public.abbreviations for select using (true);
create policy "abbreviations_insert" on public.abbreviations for insert with check (true);
create policy "abbreviations_update" on public.abbreviations for update using (true) with check (true);
create policy "abbreviations_delete" on public.abbreviations for delete using (true);

-- ============================================================================
-- Именованные шаблоны заполненного сертификата.
-- Пользователь сохраняет заполненный бланк под названием («Сохранить шаблон»)
-- и подставляет его через окно «Шаблоны». Все поля бланка (Certificate)
-- хранятся целиком в JSONB-колонке `cert`.
-- ============================================================================
create table if not exists public.certificate_templates (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  cert jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Имя шаблона уникально без учёта регистра (перезапись «того же» шаблона).
create unique index if not exists certificate_templates_name_key
  on public.certificate_templates (lower(name));

drop trigger if exists trg_certificate_templates_updated_at on public.certificate_templates;
create trigger trg_certificate_templates_updated_at
  before update on public.certificate_templates
  for each row execute function public.set_updated_at();

alter table public.certificate_templates enable row level security;

drop policy if exists "certificate_templates_select" on public.certificate_templates;
drop policy if exists "certificate_templates_insert" on public.certificate_templates;
drop policy if exists "certificate_templates_update" on public.certificate_templates;
drop policy if exists "certificate_templates_delete" on public.certificate_templates;

create policy "certificate_templates_select" on public.certificate_templates for select using (true);
create policy "certificate_templates_insert" on public.certificate_templates for insert with check (true);
create policy "certificate_templates_update" on public.certificate_templates for update using (true) with check (true);
create policy "certificate_templates_delete" on public.certificate_templates for delete using (true);
