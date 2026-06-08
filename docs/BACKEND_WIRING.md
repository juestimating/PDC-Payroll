# Backend wiring guide (Supabase)

The front-end never touches raw data directly. It reads everything through typed
selector functions in `src/lib/data/index.ts`. **Those function signatures are the
contract** your Supabase layer must fulfil. To go live, keep the signatures and swap the
internals from mock arrays to Supabase queries.

---

## 1. Suggested schema

All money columns are `bigint` (PKR, whole rupees). Every month key is `text` `YYYY-MM`.

| Table                | Key columns                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `departments`        | id, key (`sales`/`estimation`/`design`/`admin`), name, color, is_technical, is_sales |
| `teams`              | id, department_id, name                                                     |
| `employees`          | id, name, email, department_id, team_id, designation, status, joined_on     |
| `salary_structures`  | id, employee_id, basic, medical, travel, effective_from  (history)          |
| `payroll_records`    | id, employee_id, month, status, basic, medical, travel, gross, taxable, withholding_tax, net |
| `commissions`        | id, payroll_record_id, new_sales, old_bonus, additional_bonus               |
| `overtime`           | id, payroll_record_id, hours, rate_per_hour, working_days, amount           |
| `deductions`         | id, payroll_record_id, label, amount, kind                                  |
| `increments`         | id, employee_id, date, old_basic, new_basic, reason, by_user                |
| `expenses`           | id, month, department_id, category, label, amount, recurring, vendor        |
| `tasks`              | id, title, description, status, priority, assignee_id, due_date, month, kind |
| `profiles`           | id (= auth.uid), employee_id, role (`admin`/`hr`/`dept_head`/`employee`), department_id |
| `audit_log`          | id, actor, entity, entity_id, action, before, after, created_at             |

Mirror these from the TypeScript types in `src/lib/data/types.ts` — they already match.

### Integrity rules
- **Reconciliation:** store the components; compute `gross/taxable/withholding_tax/net`
  in a Postgres function or generated column so a recomputation always equals the stored
  total. The mock layer already proves this property.
- **Closed months are immutable:** a row-level policy / trigger should reject writes to
  `payroll_records` where `status = 'closed'`.
- **Audit log:** write to `audit_log` on every change to salary, increments, deductions,
  and commissions (triggers are the safest place).

---

## 2. RLS design (per role)

Enforce in Postgres, not just the UI. The UI gating in `src/lib/data/roles.ts` mirrors this.

| Role        | Scope                                                                 |
| ----------- | --------------------------------------------------------------------- |
| `admin`     | Full read/write on every table.                                       |
| `hr`        | Read/write employees, payroll, overtime, increments, deductions, tax, tasks (org-wide). |
| `dept_head` | Read/write limited to `department_id = (their profile's department)`. |
| `employee`  | Read only their own `payroll_records`, tax, payslip, and assigned tasks. |

Example policy shape for employee self-access:

```sql
create policy "employees read own payroll"
on payroll_records for select
using ( employee_id = (select employee_id from profiles where id = auth.uid()) );
```

---

## 3. Swapping mock → live

Each selector in `src/lib/data/index.ts` maps to a query. Keep the **same name, args, and
return shape**; only change the body.

| Selector                         | Becomes (roughly)                                              |
| -------------------------------- | ------------------------------------------------------------- |
| `getPayroll(month, q)`           | `select * from payroll_records join employees ... where month = $1` |
| `orgTotals(month)`               | aggregate query (or a SQL view `v_org_totals`)                |
| `departmentTotals(month)`        | `group by department_id` aggregate / view                     |
| `monthlyTrend()`                 | aggregate over all months / view                              |
| `dashboardKpis(month)`           | current + previous month aggregates                           |
| `taxRows(month, q)` / `taxTotals`| derived from `payroll_records`                                |
| `getExpenses` / `expenseTotals`  | `expenses` table                                              |
| `getOvertime` / `getDeductions` / `getIncrements` | respective tables                            |
| `getEmployees` / `getEmployee`   | `employees` table                                             |
| `getTasks(q)`                    | `tasks` table                                                 |

Heavy aggregations (`orgTotals`, `departmentTotals`, `monthlyTrend`) are best as Postgres
**views** or RPC functions so years of data stay fast. Add indexes on
`payroll_records(month)`, `payroll_records(employee_id)`, `expenses(month, department_id)`.

Reads from the browser use the anon client (`src/lib/supabase/client.ts`) gated by RLS.
Privileged writes / migrations use the server-only admin client
(`src/lib/supabase/admin.ts`).

---

## 4. Per-screen data needs (quick reference)

| Screen        | Calls                                                              |
| ------------- | ----------------------------------------------------------------- |
| Dashboard     | `dashboardKpis`, `orgTotals`, `departmentTotals`, `monthlyTrend`, `expenseTotals`, `getTasks`, `getIncrements` |
| Payroll       | `getPayroll`, per-row `PayrollRecord` for the breakdown           |
| Employees     | `getEmployees`, `getEmployee`, `getEmployeePayroll`, `getIncrements` |
| Overtime      | `getOvertime`                                                     |
| Increments    | `getIncrements`                                                   |
| Deductions    | `getDeductions`                                                   |
| Tax           | `taxRows`, `taxTotals`                                            |
| Expenses      | `getExpenses`, `expenseTotals`, `expenseTrend`                    |
| Tasks         | `getTasks`                                                        |
| Reports       | `orgTotals`, `departmentTotals`, `monthlyTrend`                   |
| My Payslip    | `getEmployee`, `getPayrollRecord`, `getEmployeePayroll`, `getTasks` |
