-- =============================================================================
-- PDC Payroll — 0010: retire the legacy required `department_id` on employees.
-- The new model scopes people by entity_id + the 9-team taxonomy (team_id); the
-- old department dimension is optional/deprecated, so new hires needn't carry it.
-- =============================================================================
alter table employees alter column department_id drop not null;
