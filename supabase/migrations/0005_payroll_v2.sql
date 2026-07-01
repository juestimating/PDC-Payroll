-- =============================================================================
-- PDC Payroll — 0005: payroll engine v2. Anchors payroll on the canonical
-- monthly `salary` (D), adds separate-payout accounting (overtime / incentive /
-- bonus), day-range segments for mid-month rate changes, pay-status lifecycle,
-- and richer overtime + commission detail tables.
--
-- Forward-only over 0001-0004. New enums are guarded; new columns use ADD COLUMN
-- IF NOT EXISTS; new tables use CREATE TABLE IF NOT EXISTS; indexes IF NOT EXISTS.
-- The old `overtime` and `commissions` tables are intentionally KEPT (not
-- dropped) — the v2 tables live alongside them until the engine cuts over.
-- Money columns are unconstrained `numeric`. No RLS / audit here.
-- =============================================================================

-- ---- pay_status enum (create BEFORE the column that uses it) ------------------
do $$ begin
  create type pay_status as enum
    ('to_pay','paid','on_hold','ghosted_no_pay','notice_not_served','pending_partial');
exception when duplicate_object then null; end $$;

-- ---- payroll_records v2 columns ----------------------------------------------
alter table payroll_records add column if not exists entity_id               text references entities(id);
alter table payroll_records add column if not exists salary                  numeric;              -- canonical D (full-month)
alter table payroll_records add column if not exists overtime_amount         numeric not null default 0;
alter table payroll_records add column if not exists incentive_amount        numeric not null default 0;
alter table payroll_records add column if not exists bonus_amount            numeric not null default 0;
alter table payroll_records add column if not exists other_deductions        numeric not null default 0;
alter table payroll_records add column if not exists advance                 numeric not null default 0;
alter table payroll_records add column if not exists arrears                 numeric not null default 0;
alter table payroll_records add column if not exists unpaid_leave_days       numeric not null default 0;
alter table payroll_records add column if not exists pay_status              pay_status not null default 'to_pay';
alter table payroll_records add column if not exists count_in_total          boolean not null default true;
alter table payroll_records add column if not exists full_month_reference_amount numeric;
alter table payroll_records add column if not exists remark_reason_code      text;
alter table payroll_records add column if not exists remark_note             text;

create index if not exists idx_payroll_entity    on payroll_records(entity_id, month);
create index if not exists idx_payroll_paystatus on payroll_records(month, pay_status);

-- ---- payroll_segments (day-range monthly-rate slices) ------------------------
create table if not exists payroll_segments (
  id                uuid primary key default gen_random_uuid(),
  payroll_record_id text not null references payroll_records(id) on delete cascade,
  from_day          int not null,
  to_day            int not null,
  monthly_rate      numeric,
  check (from_day between 1 and 31 and to_day >= from_day)
);

-- ---- salary_structures: anchor on salary + open/closed windows ---------------
-- basic/medical/travel are left as-is (the engine derives them from `salary`).
alter table salary_structures add column if not exists salary       numeric;
alter table salary_structures add column if not exists effective_to date;

-- Only one "open" (effective_to IS NULL) structure per employee.
create unique index if not exists uniq_open_salary_structure
  on salary_structures(employee_id) where effective_to is null;

-- ---- overtime_details (v2 replaces `overtime`; old table kept) ----------------
create table if not exists overtime_details (
  id                uuid primary key default gen_random_uuid(),
  payroll_record_id text not null references payroll_records(id) on delete cascade,
  entity_id         text references entities(id),
  gross_basis       numeric,
  ot_basic_factor   numeric not null default 0.65,
  standard_hours    numeric not null default 176,
  weekday_hours     numeric not null default 0,
  weekend_hours     numeric not null default 0,
  total_hours       numeric generated always as (weekday_hours + weekend_hours) stored,
  day_type          text not null default 'normal',
  multiplier        numeric not null default 1.5,
  bonus             numeric not null default 0,
  pending_other     numeric not null default 0,
  rate_per_hour     numeric,
  amount            numeric,
  sub_total         numeric
);

-- ---- incentive_status enum + commission_records (v2; old `commissions` kept) --
do $$ begin
  create type incentive_status as enum ('payable','held','already_paid');
exception when duplicate_object then null; end $$;

create table if not exists commission_records (
  id                     uuid primary key default gen_random_uuid(),
  payroll_record_id      text references payroll_records(id) on delete cascade,
  employee_id            text references employees(id),
  entity_id              text references entities(id),
  month                  text,
  prev_incremental       numeric not null default 0,
  prev_incentive         numeric not null default 0,
  incentive_amount       numeric not null default 0,
  bonus_amount           numeric not null default 0,
  accrued_total          numeric,
  payable_amount         numeric,
  withheld_amount        numeric,
  status                 incentive_status not null default 'payable',
  kpi_met                boolean not null default true,
  manual_override_pay_full boolean not null default false,
  incentive_basis        jsonb,
  bank_name              text,
  account_number         text,
  unique (employee_id, month)
);
