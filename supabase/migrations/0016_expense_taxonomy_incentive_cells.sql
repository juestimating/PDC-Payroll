-- 0016 — Expense taxonomy (3 main categories + user-addable subcategories),
-- fix the broken add-expense insert, manual sales-incentive cells, and the
-- shared JU+PDC entity code.
--
-- 1) The legacy expenses.category text column (from 0001) was still NOT NULL,
--    but createExpenseAction only writes category_id → every insert failed
--    with 23502. The column is dead (nothing reads it); make it optional.
alter table public.expenses alter column category drop not null;

-- 2) Three fixed MAIN categories; expense_categories rows become SUBcategories.
--    utility_bills — all utility bills
--    it_expense    — Online Subscriptions / IT Equipments / data
--    misc_expense  — everything else
alter table public.expense_categories
  add column if not exists main_category text not null default 'misc_expense';
alter table public.expense_categories
  drop constraint if exists expense_categories_main_category_check;
alter table public.expense_categories
  add constraint expense_categories_main_category_check
  check (main_category in ('utility_bills','it_expense','misc_expense'));

update public.expense_categories set main_category = 'utility_bills'
where id in ('utility-bills','ptcl-1st-floor','ptcl-2nd-floor','alnoor-internet','transworld-internet-pdc');
update public.expense_categories set main_category = 'it_expense'
where id in ('online-subscriptions','office365-domains','cc-data','equipment');
update public.expense_categories set main_category = 'misc_expense'
where id in ('alnoor-building-rent','kitchen-expense','office','other-expense');

-- Align the equipment subcategory with the owner's naming.
update public.expense_categories set name = 'IT Equipments' where id = 'equipment';

-- Admins add expenses, so they must also be able to add a missing subcategory
-- inline from the expense form (super_admin already can via ref_write_*).
drop policy if exists exp_cat_admin_insert on public.expense_categories;
create policy exp_cat_admin_insert on public.expense_categories
  for insert to authenticated
  with check (public.has_app_role('super_admin','admin'));

-- 3) Manual sales-incentive cells (PKR, entered directly per employee+month):
--    New Sales / Recurring / Sales Bonus.
alter table public.commission_records
  add column if not exists new_sales_amount numeric not null default 0,
  add column if not exists recurring_amount numeric not null default 0,
  add column if not exists sales_bonus_amount numeric not null default 0;

-- 4) Shared "JU + PDC" tag for resources used by both companies.
--    (The entities row itself is seeded in 0017 — a new enum value cannot be
--    used in the same transaction that adds it.)
alter type public.entity_code add value if not exists 'JU_PDC';
