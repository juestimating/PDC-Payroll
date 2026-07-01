-- =============================================================================
-- PDC Payroll — 0014: offboarding exit metadata on employees.
--
-- Forward-only. Adds the columns the Offboarding screen writes when marking an
-- employee as left. There is NO gratuity / end-of-service: the final month is
-- simply prorated to last_working_day by the payroll engine (workedDaysFor).
--
--   * exit_reason  (why the person left — constrained set)
--   * exit_note    (free-text context, optional)
--
-- last_working_day already exists (0004). Marking someone left sets
-- status='inactive' + last_working_day + exit_reason (+ optional exit_note).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + guarded constraint add.
-- =============================================================================

alter table employees add column if not exists exit_reason text;
alter table employees add column if not exists exit_note   text;

-- Constrain exit_reason to the offboarding vocabulary (null allowed for people
-- who are still active / were never offboarded).
do $$ begin
  alter table employees
    add constraint employees_exit_reason_chk
    check (exit_reason is null or exit_reason in
      ('resigned','terminated','contract_end','retired','ghosted','other'));
exception when duplicate_object then null; end $$;
