-- =============================================================================
-- PDC Payroll — initial schema, RLS, and org seed.
-- Mirrors the TypeScript types in src/lib/data/types.ts so the mock -> live
-- swap is a clean adapter change. Money columns are bigint (whole PKR).
--
-- RLS is ENABLED on every table. Baseline policies are intentionally minimal
-- and safe: org structure (departments/teams) is readable by authenticated
-- users; all sensitive tables are service-role-only until the per-role policies
-- (dept_head scoping, employee self-only) are added in the logic phase.
-- =============================================================================

-- ---- Enums -------------------------------------------------------------------
do $$ begin create type department_key as enum ('sales','estimation','design','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type employee_status as enum ('active','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type payroll_status as enum ('draft','processing','paid','closed'); exception when duplicate_object then null; end $$;
do $$ begin create type app_role as enum ('admin','hr','dept_head','employee'); exception when duplicate_object then null; end $$;
do $$ begin create type task_status as enum ('todo','in_progress','done'); exception when duplicate_object then null; end $$;
do $$ begin create type task_priority as enum ('low','medium','high'); exception when duplicate_object then null; end $$;

-- ---- Tables ------------------------------------------------------------------
create table if not exists departments (
  id            text primary key,
  key           department_key not null unique,
  name          text not null,
  color         text not null,
  is_technical  boolean not null default false,
  is_sales      boolean not null default false
);

create table if not exists teams (
  id            text primary key,
  department_id text not null references departments(id) on delete cascade,
  name          text not null
);

create table if not exists employees (
  id            text primary key,
  name          text not null,
  email         text not null unique,
  department_id text not null references departments(id),
  team_id       text not null references teams(id),
  designation   text not null,
  status        employee_status not null default 'active',
  joined_on     date not null,
  created_at    timestamptz not null default now()
);

create table if not exists salary_structures (
  id             uuid primary key default gen_random_uuid(),
  employee_id    text not null references employees(id) on delete cascade,
  basic          bigint not null,
  medical        bigint not null,
  travel         bigint not null,
  effective_from date not null default current_date,
  created_at     timestamptz not null default now()
);

create table if not exists payroll_records (
  id              text primary key,
  employee_id     text not null references employees(id) on delete cascade,
  month           text not null,                 -- YYYY-MM
  status          payroll_status not null default 'draft',
  basic           bigint not null,
  medical         bigint not null,
  travel          bigint not null,
  gross           bigint not null,
  taxable         bigint not null,
  withholding_tax bigint not null,
  net             bigint not null,
  created_at      timestamptz not null default now(),
  unique (employee_id, month)
);

create table if not exists commissions (
  id                uuid primary key default gen_random_uuid(),
  payroll_record_id text not null references payroll_records(id) on delete cascade,
  new_sales         bigint not null default 0,
  old_bonus         bigint not null default 0,
  additional_bonus  bigint not null default 0
);

create table if not exists overtime (
  id                uuid primary key default gen_random_uuid(),
  payroll_record_id text not null references payroll_records(id) on delete cascade,
  hours             numeric not null default 0,
  rate_per_hour     bigint not null default 0,
  working_days      int not null default 0,
  amount            bigint not null default 0
);

create table if not exists deductions (
  id                uuid primary key default gen_random_uuid(),
  payroll_record_id text not null references payroll_records(id) on delete cascade,
  label             text not null,
  amount            bigint not null,
  kind              text not null default 'other'
);

create table if not exists increments (
  id          text primary key,
  employee_id text not null references employees(id) on delete cascade,
  date        date not null,
  old_basic   bigint not null,
  new_basic   bigint not null,
  reason      text not null,
  by_user     text not null,
  created_at  timestamptz not null default now()
);

create table if not exists expenses (
  id            text primary key,
  month         text not null,
  department_id text not null references departments(id),
  category      text not null,
  label         text not null,
  amount        bigint not null,
  recurring     boolean not null default false,
  vendor        text,
  created_at    timestamptz not null default now()
);

create table if not exists tasks (
  id          text primary key,
  title       text not null,
  description text,
  status      task_status not null default 'todo',
  priority    task_priority not null default 'medium',
  assignee_id text references employees(id),
  due_date    date,
  month       text,
  kind        text not null default 'general',
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          app_role not null default 'employee',
  employee_id   text references employees(id),
  department_id text references departments(id),
  created_at    timestamptz not null default now()
);

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      text,
  entity     text not null,
  entity_id  text,
  action     text not null,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

-- ---- Indexes (scale: years of monthly data) ---------------------------------
create index if not exists idx_payroll_month     on payroll_records(month);
create index if not exists idx_payroll_employee  on payroll_records(employee_id);
create index if not exists idx_expenses_month    on expenses(month, department_id);
create index if not exists idx_tasks_month       on tasks(month);
create index if not exists idx_employees_dept    on employees(department_id);
create index if not exists idx_increments_emp    on increments(employee_id);

-- ---- Row Level Security ------------------------------------------------------
alter table departments       enable row level security;
alter table teams             enable row level security;
alter table employees         enable row level security;
alter table salary_structures enable row level security;
alter table payroll_records   enable row level security;
alter table commissions       enable row level security;
alter table overtime          enable row level security;
alter table deductions        enable row level security;
alter table increments        enable row level security;
alter table expenses          enable row level security;
alter table tasks             enable row level security;
alter table profiles          enable row level security;
alter table audit_log         enable row level security;

-- Baseline: authenticated users may read org structure. Everything else is
-- service-role-only (service_role bypasses RLS) until per-role policies land.
drop policy if exists "auth read departments" on departments;
create policy "auth read departments" on departments for select to authenticated using (true);

drop policy if exists "auth read teams" on teams;
create policy "auth read teams" on teams for select to authenticated using (true);

drop policy if exists "self read profile" on profiles;
create policy "self read profile" on profiles for select to authenticated using (id = auth.uid());

-- ---- Seed: org structure -----------------------------------------------------
insert into departments (id,key,name,color,is_technical,is_sales) values
  ('dept-sales','sales','Sales & Marketing','#6366f1',false,true),
  ('dept-estimation','estimation','Estimation','#0ea5e9',true,false),
  ('dept-design','design','Design','#ec4899',true,false),
  ('dept-admin','admin','Admin & HR','#14b8a6',false,false)
on conflict (id) do nothing;

insert into teams (id,department_id,name) values
  ('team-sales-inside','dept-sales','Inside Sales'),
  ('team-sales-field','dept-sales','Field & Marketing'),
  ('team-est-civil','dept-estimation','Civil Estimation'),
  ('team-est-mep','dept-estimation','MEP Estimation'),
  ('team-design-arch','dept-design','Architecture'),
  ('team-design-viz','dept-design','3D & Visualization'),
  ('team-admin-hr','dept-admin','HR & People'),
  ('team-admin-accounts','dept-admin','Accounts & Admin')
on conflict (id) do nothing;

-- Sample employees (heads + the self-service demo employee). The full 30-person
-- roster + transactional data is seeded with the calculation engine in the
-- logic phase; the front-end currently runs on the matching mock dataset.
insert into employees (id,name,email,department_id,team_id,designation,status,joined_on) values
  ('emp-001','Bilal Ahmed','bilal.ahmed@pdc.com.pk','dept-sales','team-sales-inside','Head of Sales','active','2019-03-11'),
  ('emp-002','Hamza Tariq','hamza.tariq@pdc.com.pk','dept-sales','team-sales-field','Senior Sales Executive','active','2020-07-01'),
  ('emp-009','Adnan Sheikh','adnan.sheikh@pdc.com.pk','dept-estimation','team-est-civil','Estimation Manager','active','2018-06-01'),
  ('emp-011','Owais Khan','owais.khan@pdc.com.pk','dept-estimation','team-est-mep','Estimator','active','2021-10-01'),
  ('emp-017','Ayesha Khan','ayesha.khan@pdc.com.pk','dept-design','team-design-arch','Design Lead','active','2019-08-19'),
  ('emp-023','Sadia Rauf','sadia.rauf@pdc.com.pk','dept-admin','team-admin-hr','HR Manager','active','2019-05-13')
on conflict (id) do nothing;

insert into salary_structures (employee_id,basic,medical,travel) values
  ('emp-001',300000,28000,35000),
  ('emp-002',165000,15000,20000),
  ('emp-009',280000,26000,32000),
  ('emp-011',105000,10000,13000),
  ('emp-017',260000,24000,30000),
  ('emp-023',230000,22000,27000)
on conflict do nothing;
