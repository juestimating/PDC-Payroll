-- 0017 — Seed the shared JU + PDC entity (separate file: the JU_PDC enum
-- value added in 0016 must be committed before it can be used).
insert into public.entities (id, code, name, active)
values ('JU_PDC', 'JU_PDC', 'JU + PDC (Shared)', true)
on conflict (id) do nothing;
