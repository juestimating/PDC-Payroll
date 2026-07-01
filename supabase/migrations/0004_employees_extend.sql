-- =============================================================================
-- PDC Payroll — 0004: employees extended for entity ownership, HR-grade codes,
-- probation windows, offboarding, tax address, and search.
--
-- Forward-only over 0001/0002/0003. Adds:
--   * employee_code (human PDC-#### id) with a sequence + before-insert trigger
--   * entity_id  (which owner entity carries the person)
--   * ju_sales_subtype (JU sales/marketing/BD sub-classification)
--   * probation_months + generated probation_end
--   * last_working_day + tax_address
--   * CNIC format check (NOT VALID so existing rows aren't blocked)
--   * a GIN full-text search index + entity/code lookup indexes
--
-- Codes/entities are NOT backfilled here — that is the engine seed migration
-- (0008). The sequence starts at 43 on the assumption the 42 existing rows are
-- backfilled 0001..0042 later.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE SEQUENCE/INDEX IF NOT EXISTS,
-- guarded constraint add, CREATE OR REPLACE FUNCTION, DROP+CREATE TRIGGER.
-- The trigger (employee_code generation) is explicitly permitted here.
-- =============================================================================

-- ---- Columns -----------------------------------------------------------------
alter table employees add column if not exists employee_code   text unique;
alter table employees add column if not exists entity_id       text references entities(id);
alter table employees add column if not exists ju_sales_subtype ju_sales_subtype;
alter table employees add column if not exists probation_months int not null default 2;
alter table employees add column if not exists last_working_day date;
alter table employees add column if not exists tax_address     text;

-- ---- CNIC format check (deferred validation) ---------------------------------
-- NOT VALID: existing rows (some with null/legacy CNICs) are not re-checked now;
-- a later cleanup migration will VALIDATE CONSTRAINT once the data is normalised.
do $$ begin
  alter table employees
    add constraint employees_cnic_fmt
    check (cnic is null or cnic ~ '^\d{5}-\d{7}-\d$') not valid;
exception when duplicate_object then null; end $$;

-- ---- probation_end (trigger-computed, NOT a generated column) ----------------
-- Last day inside the probation window: joined_on + probation_months − 1 day.
-- A STORED generated column can't be used: `date + N months -> date` is not an
-- IMMUTABLE expression Postgres accepts. The before-write trigger below computes it.
alter table employees add column if not exists probation_end date;

-- ---- employee_code + probation_end (before-write trigger) --------------------
create sequence if not exists employee_code_seq start 43;

-- Fills employee_code on INSERT only (so the 42 existing rows can be backfilled
-- with explicit PDC-0001..0042 codes via UPDATE without the trigger overwriting),
-- and (re)computes probation_end on any insert/update.
create or replace function employees_set_derived() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.employee_code is null then
    new.employee_code := 'PDC-' || lpad(nextval('employee_code_seq')::text, 4, '0');
  end if;
  if new.joined_on is not null and new.probation_months is not null then
    new.probation_end := (new.joined_on + make_interval(months => new.probation_months))::date - 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_employee_code on employees;
drop trigger if exists trg_employees_set_derived on employees;
create trigger trg_employees_set_derived
  before insert or update on employees
  for each row
  execute function employees_set_derived();

-- Backfill probation_end for the existing 42 rows. Code stays null here (the
-- engine seed assigns PDC-0001..0042); this UPDATE is code-safe because the
-- trigger only fills employee_code on INSERT.
update employees
  set probation_end = (joined_on + make_interval(months => probation_months))::date - 1
  where probation_end is null and joined_on is not null;

-- ---- Indexes -----------------------------------------------------------------
create index if not exists idx_employees_search on employees
  using gin (to_tsvector('simple',
    coalesce(name,'') || ' ' || coalesce(employee_code,'') || ' ' || coalesce(designation,'')));

create index if not exists idx_employees_entity on employees(entity_id);
create index if not exists idx_employees_code   on employees(employee_code);
