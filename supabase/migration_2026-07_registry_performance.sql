-- ============================================================================
-- Non-destructive performance indexes for the registry page.
-- Safe to run more than once in Supabase SQL Editor.
-- ============================================================================

create index if not exists certificates_created_at_id_idx
  on public.certificates (created_at desc, id asc);

create extension if not exists pg_trgm;

create index if not exists certificates_certificate_number_trgm_idx
  on public.certificates using gin (certificate_number gin_trgm_ops);

create index if not exists certificates_basis_date_number_trgm_idx
  on public.certificates using gin (basis_date_number gin_trgm_ops);

create index if not exists certificates_service_name_trgm_idx
  on public.certificates using gin (service_name gin_trgm_ops);

create index if not exists certificates_address_trgm_idx
  on public.certificates using gin (address gin_trgm_ops);

create index if not exists certificates_manager_name_trgm_idx
  on public.certificates using gin (manager_name gin_trgm_ops);

create index if not exists certificates_service_type_trgm_idx
  on public.certificates using gin (service_type gin_trgm_ops);

create index if not exists certificates_plan_number_trgm_idx
  on public.certificates using gin (plan_number gin_trgm_ops);

create index if not exists certificates_inspector_trgm_idx
  on public.certificates using gin (inspector gin_trgm_ops);
