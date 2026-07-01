-- =============================================================================
-- PDC Payroll — 0013: append-only audit trail.
--
-- A single SECURITY DEFINER trigger function (audit_row) writes one row to
-- audit_log for every insert/update/delete on the sensitive tables. It is
-- wrapped in an exception handler so a logging failure can NEVER roll back a
-- legitimate business write — audit is best-effort, the data write wins.
--
-- Sensitive PII columns (cnic, account, account_title) are REDACTED from the
-- before/after snapshots so the audit trail itself does not become a second
-- copy of that data.
--
-- The log is append-only: UPDATE/DELETE are revoked from `authenticated` and a
-- guard trigger raises on any attempt to mutate existing rows. service_role
-- bypasses RLS/grants, so this is enforced at the trigger level too.
--
-- Idempotent: create-or-replace function + drop-trigger-if-exists throughout.
-- =============================================================================

-- ---- audit_log columns the function writes to --------------------------------
-- The 0001 table has (id, actor, entity, entity_id, action, before, after,
-- created_at). Add actor_id (the auth uid) and `at` here, idempotently, so the
-- function below can populate them without depending on an out-of-band change.
alter table audit_log add column if not exists actor_id uuid;
alter table audit_log add column if not exists at       timestamptz not null default now();

-- ---- Trigger function --------------------------------------------------------
create or replace function public.audit_row() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  begin
    insert into audit_log (actor_id, actor, entity, entity_id, action, before, after)
    values (
      auth.uid(),
      coalesce(auth.uid()::text, 'service'),
      tg_table_name,
      coalesce(
        (to_jsonb(new) ->> 'id'),
        (to_jsonb(old) ->> 'id')
      ),
      lower(tg_op),
      case
        when tg_op in ('UPDATE', 'DELETE')
          then to_jsonb(old) - 'cnic' - 'account' - 'account_title'
        else null
      end,
      case
        when tg_op in ('INSERT', 'UPDATE')
          then to_jsonb(new) - 'cnic' - 'account' - 'account_title'
        else null
      end
    );
  exception when others then
    -- Never let auditing fail a real write. Swallow and continue.
    return coalesce(new, old);
  end;
  return coalesce(new, old);
end;
$$;

-- ---- Attach row triggers to every sensitive table ----------------------------
-- after insert or update or delete, for each row.
drop trigger if exists trg_audit on employees;
create trigger trg_audit after insert or update or delete on employees
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on salary_structures;
create trigger trg_audit after insert or update or delete on salary_structures
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on payroll_records;
create trigger trg_audit after insert or update or delete on payroll_records
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on loans;
create trigger trg_audit after insert or update or delete on loans
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on loan_installments;
create trigger trg_audit after insert or update or delete on loan_installments
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on loan_payment_approvals;
create trigger trg_audit after insert or update or delete on loan_payment_approvals
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on advances;
create trigger trg_audit after insert or update or delete on advances
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on unpaid_leaves;
create trigger trg_audit after insert or update or delete on unpaid_leaves
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on increments;
create trigger trg_audit after insert or update or delete on increments
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on commission_records;
create trigger trg_audit after insert or update or delete on commission_records
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on expenses;
create trigger trg_audit after insert or update or delete on expenses
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on tax_register_entries;
create trigger trg_audit after insert or update or delete on tax_register_entries
  for each row execute function public.audit_row();

drop trigger if exists trg_audit on profiles;
create trigger trg_audit after insert or update or delete on profiles
  for each row execute function public.audit_row();

-- ---- Make audit_log append-only ---------------------------------------------
-- No one but service_role should ever rewrite history. Revoke mutation from the
-- authenticated role, and add a hard guard so even elevated paths cannot.
revoke update, delete on audit_log from authenticated;

create or replace function public.audit_log_immutable() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op;
end;
$$;

drop trigger if exists trg_audit_log_immutable on audit_log;
create trigger trg_audit_log_immutable
  before update or delete on audit_log
  for each row execute function public.audit_log_immutable();
