-- =============================================================================
-- PDC Payroll — 0003: entities, taxonomy, salary policy, and MONEY PRECISION.
--
-- Forward-only over 0001/0002. This migration introduces the multi-entity model
-- (JU / PDC / B4U), the real team taxonomy (9 functional teams), the salary
-- component policy (65/10/10/15 with the 10/110 medical rule), the expense
-- category catalogue (fixed vs variable), and an allocation-rules table for the
-- cost-allocation engine (single_entity | fixed_pct | explicit | team_routing |
-- pre_split).
--
-- It ALSO widens every money column from numeric(14,2) / bigint to unconstrained
-- `numeric` so full-precision PKR (paisa, WHT carry, allocation remainders) is
-- never silently rounded at the storage layer. Rounding is a display concern.
--
-- Idempotent: enum creates are guarded, tables use IF NOT EXISTS / ADD COLUMN IF
-- NOT EXISTS, seeds use ON CONFLICT DO NOTHING, type widenings are no-ops on
-- re-run. No RLS / audit / SECURITY DEFINER here (handled separately).
-- =============================================================================

-- ---- Enums -------------------------------------------------------------------
do $$ begin create type entity_code as enum ('JU','PDC','B4U'); exception when duplicate_object then null; end $$;
do $$ begin create type team_kind as enum ('cold_calling','email_marketing','social_media_marketing','business_development','estimation','design_3d','hr_legal','admin','outsource'); exception when duplicate_object then null; end $$;
do $$ begin create type ju_sales_subtype as enum ('sales_team','marketing','business_development'); exception when duplicate_object then null; end $$;
do $$ begin create type expense_category_kind as enum ('fixed','variable'); exception when duplicate_object then null; end $$;
do $$ begin create type allocation_method as enum ('single_entity','fixed_pct','explicit','team_routing','pre_split'); exception when duplicate_object then null; end $$;

-- ---- Entities ----------------------------------------------------------------
create table if not exists entities (
  id     text primary key,          -- == code
  code   entity_code not null unique,
  name   text not null,
  active boolean not null default true
);

insert into entities (id,code,name,active) values
  ('JU','JU','JU Estimation',true),
  ('PDC','PDC','Pavilion Design Consultants',true),
  ('B4U','B4U','Bed Sheet 4u',true)
on conflict (id) do nothing;

-- ---- Teams: extend 0001 teams(id, department_id, name) -----------------------
-- 0001 declared department_id NOT NULL; the new functional teams are org-wide
-- (no single department), so relax the constraint before seeding.
alter table teams alter column department_id drop not null;

alter table teams add column if not exists kind         team_kind;
alter table teams add column if not exists is_technical boolean not null default false;
alter table teams add column if not exists is_sales     boolean not null default false;

insert into teams (id,department_id,name,kind,is_technical,is_sales) values
  ('team-cold-calling',        null,'Cold Calling',              'cold_calling',            false,true),
  ('team-email-marketing',     null,'Email Marketing',           'email_marketing',         false,true),
  ('team-social-media',        null,'Social Media Marketing',    'social_media_marketing',  false,true),
  ('team-business-development', null,'Business Development',      'business_development',     false,true),
  ('team-estimation',          null,'Estimation',                'estimation',              true, false),
  ('team-design-3d',           null,'3D Design',                 'design_3d',               true, false),
  ('team-hr-legal',            null,'HR & Legal',                'hr_legal',                false,false),
  ('team-admin',               null,'Admin',                     'admin',                   false,false),
  ('team-outsource',           null,'Outsource',                 'outsource',               false,false)
on conflict (id) do nothing;

-- ---- Salary component policy -------------------------------------------------
create table if not exists salary_component_policy (
  id                      text primary key default 'default',
  basic_pct               numeric not null default 0.65,
  ta_pct                  numeric not null default 0.10,
  medical_pct             numeric not null default 0.10,
  hra_pct                 numeric not null default 0.15,
  medical_tax_numerator   numeric not null default 10,
  medical_tax_denominator numeric not null default 110
);

insert into salary_component_policy
  (id,basic_pct,ta_pct,medical_pct,hra_pct,medical_tax_numerator,medical_tax_denominator)
values ('default',0.65,0.10,0.10,0.15,10,110)
on conflict (id) do nothing;

-- ---- Expense categories ------------------------------------------------------
create table if not exists expense_categories (
  id                text primary key,   -- slug
  name              text not null,
  kind              expense_category_kind not null,
  requires_detail   boolean not null default false,
  default_entity_id text references entities(id)
);

-- FIXED categories
insert into expense_categories (id,name,kind,requires_detail,default_entity_id) values
  ('office',                 'Office',                  'fixed',   false, null),
  ('cc-data',                'CC Data',                 'fixed',   false, null),
  ('office365-domains',      'Office 365 / Domains',    'fixed',   false, null),
  ('alnoor-building-rent',   'Alnoor Building Rent',    'fixed',   false, null),
  ('ptcl-1st-floor',         'PTCL 1st Floor',          'fixed',   false, null),
  ('ptcl-2nd-floor',         'PTCL 2nd Floor',          'fixed',   false, null),
  ('transworld-internet-pdc','Transworld Internet PDC', 'fixed',   false, null),
  ('alnoor-internet',        'Alnoor Internet',         'fixed',   false, null)
on conflict (id) do nothing;

-- VARIABLE categories (requires_detail = true)
insert into expense_categories (id,name,kind,requires_detail,default_entity_id) values
  ('utility-bills',       'Utility Bills',       'variable', true, null),
  ('online-subscriptions','Online Subscriptions','variable', true, null),
  ('equipment',           'Equipment',           'variable', true, null),
  ('kitchen-expense',     'Kitchen Expense',     'variable', true, null),
  ('other-expense',       'Other Expense',       'variable', true, null)
on conflict (id) do nothing;

-- ---- Allocation rules (seeded later) -----------------------------------------
create table if not exists allocation_rules (
  id             uuid primary key default gen_random_uuid(),
  line_key       text,
  method         allocation_method,
  params         jsonb not null,
  effective_from date not null default current_date,
  confirmed      boolean not null default false,
  note           text
);

-- ---- Money precision: widen every money column to unconstrained numeric ------
-- payroll_records money columns (were numeric(14,2) after 0002; basic/medical/
-- travel/gross/taxable/withholding_tax/net were widened there — re-widen to bare
-- numeric so scale is unconstrained).
alter table payroll_records alter column basic           type numeric;
alter table payroll_records alter column medical         type numeric;
alter table payroll_records alter column travel          type numeric;
alter table payroll_records alter column gross           type numeric;
alter table payroll_records alter column taxable         type numeric;
alter table payroll_records alter column withholding_tax type numeric;
alter table payroll_records alter column net             type numeric;
alter table payroll_records alter column contract_gross  type numeric;

-- salary_structures money columns
alter table salary_structures alter column basic   type numeric;
alter table salary_structures alter column medical type numeric;
alter table salary_structures alter column travel  type numeric;

-- commissions amount columns (were bigint in 0001, numeric(14,2) after 0002)
alter table commissions alter column new_sales        type numeric;
alter table commissions alter column old_bonus        type numeric;
alter table commissions alter column additional_bonus type numeric;

-- overtime amount columns (rate_per_hour/amount widened in 0002; amount == money)
alter table overtime alter column rate_per_hour type numeric;
alter table overtime alter column amount        type numeric;

-- deductions amount column (bigint in 0001)
alter table deductions alter column amount type numeric;

-- increments money columns (bigint in 0001)
alter table increments alter column old_basic type numeric;
alter table increments alter column new_basic type numeric;

-- expenses amount column (bigint in 0001)
alter table expenses alter column amount type numeric;
