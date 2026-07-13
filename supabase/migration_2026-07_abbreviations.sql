-- ============================================================================
-- Миграция: справочник автозамен (сокращений) `abbreviations`.
-- Пользователь задаёт короткую форму, которая при вводе в поля бланка
-- разворачивается в полную. Выполните один раз в Supabase → SQL Editor.
-- ============================================================================

-- Функция обновления updated_at (создаётся, если её ещё нет).
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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
