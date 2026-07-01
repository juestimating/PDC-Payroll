-- =============================================================================
-- PDC Payroll — 0009: backfill the 42 existing employees onto the multi-entity
-- model — entity (JU/PDC/B4U), the new 9-team taxonomy, JU sales sub-type, and a
-- stable PDC-#### code — then tag the existing payroll rows by entity so the
-- entity-scoped RLS + per-entity P&L work. Idempotent (guards on null / re-derive).
--
-- Entity routing (matches the workbook allocation): Design/3D + Social-media/video
-- content -> PDC; everyone else -> JU. (B4U carries no salaried roster member here;
-- its cost is an allocation carve-out, not a payroll line.)
-- =============================================================================

-- ---- employee_code: PDC-0001..0042 by id order ------------------------------
with ordered as (
  select id, row_number() over (order by id) as rn from employees
)
update employees e
  set employee_code = 'PDC-' || lpad(o.rn::text, 4, '0')
  from ordered o
  where o.id = e.id and e.employee_code is null;

-- ---- entity_id --------------------------------------------------------------
update employees set entity_id = case
  when department_id = 'dept-design' then 'PDC'
  when designation ilike '%social media%' or designation ilike '%video editor%' then 'PDC'
  else 'JU'
end
where entity_id is null;

-- ---- new team taxonomy (reassign team_id to the 0003 functional teams) -------
update employees set team_id = case
  when department_id = 'dept-estimation'                              then 'team-estimation'
  when department_id = 'dept-design'                                  then 'team-design-3d'
  when department_id = 'dept-admin' and designation ilike '%hr%'      then 'team-hr-legal'
  when department_id = 'dept-admin'                                   then 'team-admin'
  when designation ilike '%calling%'                                 then 'team-cold-calling'
  when designation ilike '%social media%' or designation ilike '%video editor%' then 'team-social-media'
  when designation ilike '%marketing%'                               then 'team-email-marketing'
  else 'team-business-development'
end
where team_id in (
  'team-sales-inside','team-sales-field','team-est-civil','team-est-mep',
  'team-design-arch','team-design-viz','team-admin-hr','team-admin-accounts'
);

-- ---- JU sales/marketing/BD sub-type -----------------------------------------
update employees set ju_sales_subtype = (case
  when entity_id = 'JU' and team_id = 'team-cold-calling'         then 'sales_team'
  when entity_id = 'JU' and team_id = 'team-email-marketing'      then 'marketing'
  when entity_id = 'JU' and team_id = 'team-business-development' then 'business_development'
  else null
end)::ju_sales_subtype;

-- ---- tax_address default = city ---------------------------------------------
update employees set tax_address = city where tax_address is null and city is not null;

-- ---- tag existing payroll rows by the employee's entity ---------------------
update payroll_records p
  set entity_id = e.entity_id
  from employees e
  where e.id = p.employee_id and p.entity_id is null;

-- ---- anchor salary on the structure's basic+medical (salary = D) -------------
update salary_structures s
  set salary = coalesce(s.salary, s.basic + s.medical + coalesce(s.travel,0))
  where s.salary is null;
