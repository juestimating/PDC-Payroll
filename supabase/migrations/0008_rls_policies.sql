-- =============================================================================
-- PDC Payroll — 0008: Row-Level Security policies for the 5-role model.
--
-- Deny-by-default: RLS is enabled on every table; a role sees/does ONLY what a
-- matching policy allows. Nothing is `to public`/`to anon`. Role + entity scope
-- come from the SECURITY DEFINER helpers in 0007 (public.has_app_role / _scope),
-- never a recursive profiles subquery. service_role bypasses RLS (server jobs).
--
-- Roles: super_admin (all), admin (expenses + loan-payment approval + broad read),
-- hr (people/payroll/loans/leaves/increments), sales_lead (incentives, own entity),
-- estimation_lead (overtime, own entity). Leads are entity-scoped via entity_scope
-- (null = all entities).
-- =============================================================================

-- ---- enable RLS on the tables added in 0003-0006 -----------------------------
alter table entities                enable row level security;
alter table salary_component_policy enable row level security;
alter table expense_categories      enable row level security;
alter table allocation_rules        enable row level security;
alter table payroll_segments        enable row level security;
alter table overtime_details        enable row level security;
alter table commission_records      enable row level security;
alter table loans                   enable row level security;
alter table loan_installments       enable row level security;
alter table loan_payment_approvals  enable row level security;
alter table advances                enable row level security;
alter table unpaid_leaves           enable row level security;
alter table tax_register_entries    enable row level security;

-- =============================================================================
-- Reference data: readable by any authenticated user; writable by super_admin
-- (allocation_rules also by admin). departments/teams already have a read policy
-- from 0001 — re-assert to be explicit.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['departments','teams','entities','expense_categories','salary_component_policy']
  loop
    execute format('drop policy if exists %I on %I', 'ref_read_'||t, t);
    execute format('create policy %I on %I for select to authenticated using (true)', 'ref_read_'||t, t);
    execute format('drop policy if exists %I on %I', 'ref_write_'||t, t);
    execute format($f$create policy %I on %I for all to authenticated
      using (public.has_app_role('super_admin')) with check (public.has_app_role('super_admin'))$f$, 'ref_write_'||t, t);
  end loop;
end $$;

drop policy if exists alloc_read  on allocation_rules;
create policy alloc_read  on allocation_rules for select to authenticated using (true);
drop policy if exists alloc_write on allocation_rules;
create policy alloc_write on allocation_rules for all to authenticated
  using (public.has_app_role('super_admin','admin')) with check (public.has_app_role('super_admin','admin'));

-- =============================================================================
-- Employees: readable by all authenticated (internal team); writable super_admin/hr.
-- (PII masking / sidecar is layered on in the Phase-9 hardening migration.)
-- =============================================================================
drop policy if exists emp_read  on employees;
create policy emp_read  on employees for select to authenticated using (true);
drop policy if exists emp_write on employees;
create policy emp_write on employees for all to authenticated
  using (public.has_app_role('super_admin','hr')) with check (public.has_app_role('super_admin','hr'));

-- =============================================================================
-- Salary structures / increments: super_admin+admin+hr read; super_admin+hr write.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['salary_structures','increments','advances','unpaid_leaves','payroll_segments']
  loop
    execute format('drop policy if exists %I on %I', 'r_'||t, t);
    execute format($f$create policy %I on %I for select to authenticated
      using (public.has_app_role('super_admin','admin','hr'))$f$, 'r_'||t, t);
    execute format('drop policy if exists %I on %I', 'w_'||t, t);
    execute format($f$create policy %I on %I for all to authenticated
      using (public.has_app_role('super_admin','hr')) with check (public.has_app_role('super_admin','hr'))$f$, 'w_'||t, t);
  end loop;
end $$;

-- =============================================================================
-- Payroll records: super_admin+admin+hr full read; leads read only their entity.
-- Write: super_admin + hr.
-- =============================================================================
drop policy if exists pr_read on payroll_records;
create policy pr_read on payroll_records for select to authenticated using (
  public.has_app_role('super_admin','admin','hr')
  or (public.has_app_role('sales_lead','estimation_lead')
      and (public.current_entity_scope() is null or entity_id = public.current_entity_scope()))
);
drop policy if exists pr_write on payroll_records;
create policy pr_write on payroll_records for all to authenticated
  using (public.has_app_role('super_admin','hr')) with check (public.has_app_role('super_admin','hr'));

-- =============================================================================
-- Overtime details: read by all authenticated; write super_admin/hr, and
-- estimation_lead within their entity scope.
-- =============================================================================
drop policy if exists ot_read on overtime_details;
create policy ot_read on overtime_details for select to authenticated using (true);
drop policy if exists ot_write on overtime_details;
create policy ot_write on overtime_details for all to authenticated
  using (
    public.has_app_role('super_admin','hr')
    or (public.has_app_role('estimation_lead')
        and (public.current_entity_scope() is null or entity_id = public.current_entity_scope()))
  )
  with check (
    public.has_app_role('super_admin','hr')
    or (public.has_app_role('estimation_lead')
        and (public.current_entity_scope() is null or entity_id = public.current_entity_scope()))
  );

-- =============================================================================
-- Commission records: read by all authenticated; write super_admin/hr, and
-- sales_lead within their entity scope.
-- =============================================================================
drop policy if exists cm_read on commission_records;
create policy cm_read on commission_records for select to authenticated using (true);
drop policy if exists cm_write on commission_records;
create policy cm_write on commission_records for all to authenticated
  using (
    public.has_app_role('super_admin','hr')
    or (public.has_app_role('sales_lead')
        and (public.current_entity_scope() is null or entity_id = public.current_entity_scope()))
  )
  with check (
    public.has_app_role('super_admin','hr')
    or (public.has_app_role('sales_lead')
        and (public.current_entity_scope() is null or entity_id = public.current_entity_scope()))
  );

-- =============================================================================
-- Loans + installments: super_admin+admin+hr read; super_admin+hr write.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['loans','loan_installments']
  loop
    execute format('drop policy if exists %I on %I', 'lr_'||t, t);
    execute format($f$create policy %I on %I for select to authenticated
      using (public.has_app_role('super_admin','admin','hr'))$f$, 'lr_'||t, t);
    execute format('drop policy if exists %I on %I', 'lw_'||t, t);
    execute format($f$create policy %I on %I for all to authenticated
      using (public.has_app_role('super_admin','hr')) with check (public.has_app_role('super_admin','hr'))$f$, 'lw_'||t, t);
  end loop;
end $$;

-- =============================================================================
-- Loan payment approvals — the maker/checker gate (HR proposes, admin decides).
--   * read: super_admin/admin/hr
--   * insert (request): super_admin/hr, only as themselves, only status='pending'
--   * update (decide): super_admin/admin, must set decided_by = self, never on
--     their own request (also backed by the table CHECK decided_by <> requested_by)
-- =============================================================================
drop policy if exists lpa_read on loan_payment_approvals;
create policy lpa_read on loan_payment_approvals for select to authenticated
  using (public.has_app_role('super_admin','admin','hr'));

drop policy if exists lpa_request on loan_payment_approvals;
create policy lpa_request on loan_payment_approvals for insert to authenticated
  with check (
    public.has_app_role('super_admin','hr')
    and requested_by = auth.uid()
    and status = 'pending'
    and decided_by is null
  );

drop policy if exists lpa_decide on loan_payment_approvals;
create policy lpa_decide on loan_payment_approvals for update to authenticated
  using (public.has_app_role('super_admin','admin'))
  with check (
    public.has_app_role('super_admin','admin')
    and decided_by = auth.uid()
    and decided_by <> requested_by
    and status in ('approved','rejected')
  );

-- =============================================================================
-- Expenses: super_admin+admin+hr read; super_admin+admin write (admin logs them).
-- =============================================================================
drop policy if exists exp_read on expenses;
create policy exp_read on expenses for select to authenticated
  using (public.has_app_role('super_admin','admin','hr'));
drop policy if exists exp_write on expenses;
create policy exp_write on expenses for all to authenticated
  using (public.has_app_role('super_admin','admin')) with check (public.has_app_role('super_admin','admin'));

-- =============================================================================
-- Tax register: super_admin+admin+hr read; super_admin+hr write.
-- =============================================================================
drop policy if exists tax_read on tax_register_entries;
create policy tax_read on tax_register_entries for select to authenticated
  using (public.has_app_role('super_admin','admin','hr'));
drop policy if exists tax_write on tax_register_entries;
create policy tax_write on tax_register_entries for all to authenticated
  using (public.has_app_role('super_admin','hr')) with check (public.has_app_role('super_admin','hr'));

-- =============================================================================
-- Tasks: any authenticated user reads/writes (shared workspace).
-- =============================================================================
drop policy if exists tasks_all on tasks;
create policy tasks_all on tasks for all to authenticated using (true) with check (true);

-- =============================================================================
-- Profiles: self read + super_admin full control.
-- =============================================================================
drop policy if exists p_self_read on profiles;
create policy p_self_read on profiles for select to authenticated using (id = auth.uid());
drop policy if exists p_sa_all on profiles;
create policy p_sa_all on profiles for all to authenticated
  using (public.has_app_role('super_admin')) with check (public.has_app_role('super_admin'));

-- =============================================================================
-- Audit log: super_admin/admin/hr may READ; nobody writes via the API (only the
-- SECURITY DEFINER audit trigger inserts; hardening migration revokes UPD/DEL).
-- =============================================================================
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select to authenticated
  using (public.has_app_role('super_admin','admin','hr'));
