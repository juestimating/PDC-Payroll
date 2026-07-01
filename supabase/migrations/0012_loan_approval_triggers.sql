-- =============================================================================
-- PDC Payroll — 0012: DB-enforced loan maker/checker (separation of duties).
--   (1) An installment cannot become 'paid' unless an APPROVED approval exists
--       for it — so HR (who can write installments) still cannot self-clear.
--   (2) Approving a payment request auto-marks the installment paid and reduces
--       the loan's outstanding balance (clearing the loan when it hits 0).
-- Both are SECURITY DEFINER so they hold regardless of the caller's RLS role.
-- =============================================================================

create or replace function enforce_installment_paid() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and coalesce(old.status::text, '') <> 'paid' then
    if not exists (
      select 1 from loan_payment_approvals a
      where a.installment_id = new.id and a.status = 'approved'
    ) then
      raise exception 'Installment cannot be marked paid without an approved payment approval';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_installment_paid on loan_installments;
create trigger trg_enforce_installment_paid
  before update on loan_installments
  for each row execute function enforce_installment_paid();

create or replace function apply_loan_approval() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  inst loan_installments%rowtype;
  rem numeric;
begin
  if new.status = 'approved'
     and coalesce(old.status::text, '') <> 'approved'
     and new.installment_id is not null then
    select * into inst from loan_installments where id = new.installment_id;
    if inst.id is not null and inst.status::text <> 'paid' then
      update loan_installments set status = 'paid' where id = inst.id;
      update loans
        set outstanding = greatest(0, coalesce(outstanding, 0) - coalesce(inst.amount, 0))
        where id = new.loan_id
        returning outstanding into rem;
      if rem is not null and rem <= 0 then
        update loans set status = 'cleared' where id = new.loan_id;
      end if;
    end if;
  elsif new.status = 'rejected'
     and coalesce(old.status::text, '') <> 'rejected'
     and new.installment_id is not null then
    -- revert the installment back to scheduled (admin lacks direct RLS write here)
    update loan_installments set status = 'scheduled'
      where id = new.installment_id and status::text = 'pending_approval';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_loan_approval on loan_payment_approvals;
create trigger trg_apply_loan_approval
  after update on loan_payment_approvals
  for each row execute function apply_loan_approval();
