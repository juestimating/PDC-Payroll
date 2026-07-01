-- =============================================================================
-- PDC Payroll — 0015: let overtime be logged standalone (per employee + month)
-- rather than only attached to a payroll_record. The live payroll is computed,
-- not row-stored, so overtime attaches to employee_id + month directly.
-- =============================================================================
alter table overtime_details alter column payroll_record_id drop not null;
alter table overtime_details add column if not exists employee_id text references employees(id);
alter table overtime_details add column if not exists month text;
create index if not exists idx_overtime_emp_month on overtime_details(employee_id, month);
