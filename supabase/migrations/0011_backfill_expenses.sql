-- =============================================================================
-- PDC Payroll — 0011: map the existing (April) expense rows onto the new model
-- (entity_id + category_id + is_fixed). Best-effort category mapping by label;
-- admin can reclassify in the UI. Idempotent (guards on null).
-- =============================================================================
update expenses set category_id = case
  when label ilike '%alnoor building%'                                then 'alnoor-building-rent'
  when label ilike '%ptcl 1st%'                                      then 'ptcl-1st-floor'
  when label ilike '%ptcl 2nd%'                                      then 'ptcl-2nd-floor'
  when label ilike '%transword%pdc%' or label ilike '%transworld%pdc%' then 'transworld-internet-pdc'
  when label ilike '%alnoor internet%'                               then 'alnoor-internet'
  when label ilike '%cc data%'                                       then 'cc-data'
  when label ilike '%office 365%' or label ilike '%domain%'          then 'office365-domains'
  when label ilike '%kitchen%' or label ilike '%daig%'               then 'kitchen-expense'
  when label ilike '%lcd%' or label ilike '%system%'                 then 'equipment'
  when label ilike '%office building rent%'                          then 'utility-bills'
  when category = 'Utilities'                                        then 'utility-bills'
  else 'other-expense'
end
where category_id is null;

update expenses set entity_id = case when label ilike '%pdc%' then 'PDC' else 'JU' end
where entity_id is null;

update expenses e set is_fixed = (c.kind = 'fixed')
  from expense_categories c
  where c.id = e.category_id and e.is_fixed is null;
