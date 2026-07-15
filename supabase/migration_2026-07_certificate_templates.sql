-- ============================================================================
-- Именованные шаблоны заполненного сертификата.
-- Пользователь заполняет бланк и сохраняет его под своим названием
-- («Сохранить шаблон»), затем находит и подставляет через окно «Шаблоны».
-- Значения полей бланка хранятся целиком в JSONB-колонке `cert`.
-- Выполните этот скрипт один раз в Supabase → SQL Editor.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.certificate_templates (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  -- Снимок всех печатаемых и дополнительных полей сертификата (Certificate).
  cert jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Имя шаблона уникально без учёта регистра (перезапись «того же» шаблона).
create unique index if not exists certificate_templates_name_key
  on public.certificate_templates (lower(name));

-- Автообновление updated_at (функция set_updated_at создана в schema.sql).
drop trigger if exists trg_certificate_templates_updated_at on public.certificate_templates;
create trigger trg_certificate_templates_updated_at
  before update on public.certificate_templates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security — открытые политики (внутренний инструмент, anon-ключ),
-- как и у остальных таблиц. При необходимости замените на проверку auth.uid().
-- ----------------------------------------------------------------------------
alter table public.certificate_templates enable row level security;

drop policy if exists "certificate_templates_select" on public.certificate_templates;
drop policy if exists "certificate_templates_insert" on public.certificate_templates;
drop policy if exists "certificate_templates_update" on public.certificate_templates;
drop policy if exists "certificate_templates_delete" on public.certificate_templates;

create policy "certificate_templates_select" on public.certificate_templates for select using (true);
create policy "certificate_templates_insert" on public.certificate_templates for insert with check (true);
create policy "certificate_templates_update" on public.certificate_templates for update using (true) with check (true);
create policy "certificate_templates_delete" on public.certificate_templates for delete using (true);
