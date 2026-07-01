-- =============================================================================
-- PDC Payroll — 0006: HR operations. Loans + installment schedules with a
-- maker/checker approval trail, monthly advances, unpaid-leave tracking,
-- increment enrichment (percent/absolute + component split), expense enrichment
-- (entity + category + fixed flag), and the monthly tax register (challan-grade
-- WHT filing rows).
--
-- Forward-only over 0001-0005. Enums are created BEFORE the tables/columns that
-- use them. Idempotent: guarded enum creates, CREATE TABLE / ADD COLUMN IF NOT
-- EXISTS. Check constraints are inline (permitted). Every FK targets a table
-- that exists by the time the statement runs. No RLS / audit here.
-- =============================================================================

-- ---- Enums (must precede first use) ------------------------------------------
do $$ begin create type loan_repayment_kind as enum ('fixed_amount','fixed_percent'); exception when duplicate_object then null; end $$;
do $$ begin create type loan_status         as enum ('active','cleared','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type installment_status  as enum ('scheduled','pending_approval','paid','skipped','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type approval_status     as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type increment_kind      as enum ('percent','absolute'); exception when duplicate_object then null; end $$;
do $$ begin create type tax_register_status as enum ('draft','challan_generated','paid','filed'); exception when duplicate_object then null; end $$;

-- ---- Loans -------------------------------------------------------------------
create table if not exists loans (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        text references employees(id),
  entity_id          text references entities(id),
  principal          numeric,
  start_date         date,
  repayment_kind     loan_repayment_kind,
  installment_amount numeric,
  installment_percent numeric,
  status             loan_status not null default 'active',
  outstanding        numeric,
  approved_by        uuid,
  note               text,
  created_at         timestamptz not null default now(),
  check (
    (repayment_kind = 'fixed_amount'  and installment_amount  is not null) or
    (repayment_kind = 'fixed_percent' and installment_percent is not null)
  )
);

-- ---- Loan installments -------------------------------------------------------
create table if not exists loan_installments (
  id                uuid primary key default gen_random_uuid(),
  loan_id           uuid not null references loans(id) on delete cascade,
  employee_id       text references employees(id),
  month             text,
  seq               int,
  amount            numeric,
  status            installment_status not null default 'scheduled',
  payroll_record_id text references payroll_records(id),
  unique (loan_id, month)
);

-- ---- Loan payment approvals (maker/checker) ----------------------------------
create table if not exists loan_payment_approvals (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references loans(id) on delete cascade,
  installment_id uuid references loan_installments(id),
  requested_by   uuid,
  requested_at   timestamptz not null default now(),
  status         approval_status not null default 'pending',
  decided_by     uuid,
  decided_at     timestamptz,
  decision_note  text,
  check (decided_by is null or decided_by <> requested_by)
);

-- ---- Advances ----------------------------------------------------------------
create table if not exists advances (
  id                uuid primary key default gen_random_uuid(),
  employee_id       text references employees(id),
  entity_id         text references entities(id),
  month             text,
  amount            numeric,
  payroll_record_id text references payroll_records(id),
  unique (employee_id, month)
);

-- ---- Unpaid leaves -----------------------------------------------------------
create table if not exists unpaid_leaves (
  id          uuid primary key default gen_random_uuid(),
  employee_id text references employees(id),
  month       text,
  leave_days  numeric,
  note        text,
  check (leave_days >= 0 and (leave_days * 2) = floor(leave_days * 2)),  -- half-day granularity
  unique (employee_id, month)
);

-- ---- Increments: enrich (keep old_basic/new_basic) ---------------------------
alter table increments add column if not exists kind            increment_kind not null default 'percent';
alter table increments add column if not exists percent         numeric;
alter table increments add column if not exists old_salary      numeric;
alter table increments add column if not exists new_salary      numeric;
alter table increments add column if not exists component_split jsonb;

-- ---- Expenses: enrich (entity + category + fixed flag) -----------------------
alter table expenses alter column department_id drop not null;
alter table expenses add column if not exists entity_id   text references entities(id);
alter table expenses add column if not exists category_id text references expense_categories(id);
alter table expenses add column if not exists is_fixed    boolean;
alter table expenses add column if not exists description text;

-- ---- Tax register (monthly WHT filing rows) ----------------------------------
create table if not exists tax_register_entries (
  id                          uuid primary key default gen_random_uuid(),
  month                       text,
  employee_id                 text references employees(id),
  entity_id                   text references entities(id),
  cnic                        text,
  tax_address                 text,
  gross_salary                numeric,
  taxable_salary              numeric,
  wht                         numeric,
  refundable_adjustment       numeric not null default 0,
  net_payable                 numeric,
  challan_number              text,
  paid_on                     date,
  challan_attachment_path     text,
  paid_receipt_attachment_path text,
  status                      tax_register_status not null default 'draft',
  unique (month, employee_id)
);
