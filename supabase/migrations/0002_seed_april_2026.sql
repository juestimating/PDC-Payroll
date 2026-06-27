-- =============================================================================
-- PDC Payroll — REAL April 2026 seed (42 employees, payroll, commissions,
-- overtime, operational expenses). Extends the schema for real payroll grade:
-- banking/PII columns, probation flag, day-proration, and fractional PKR.
-- Generated from the production dataset; safe to re-run (idempotent upserts).
-- =============================================================================

-- ---- schema extensions -------------------------------------------------------
alter table employees
  add column if not exists on_probation boolean not null default false,
  add column if not exists bank text,
  add column if not exists account text,
  add column if not exists account_title text,
  add column if not exists cnic text,
  add column if not exists city text,
  add column if not exists note text;

alter table payroll_records
  add column if not exists days int not null default 30,
  add column if not exists contract_gross numeric(14,2) not null default 0;

-- widen money columns to fractional PKR (real WHT/net carry paisa)
alter table salary_structures alter column basic   type numeric(14,2);
alter table salary_structures alter column medical type numeric(14,2);
alter table salary_structures alter column travel  type numeric(14,2);
alter table payroll_records   alter column basic           type numeric(14,2);
alter table payroll_records   alter column medical         type numeric(14,2);
alter table payroll_records   alter column travel          type numeric(14,2);
alter table payroll_records   alter column gross           type numeric(14,2);
alter table payroll_records   alter column taxable         type numeric(14,2);
alter table payroll_records   alter column withholding_tax type numeric(14,2);
alter table payroll_records   alter column net             type numeric(14,2);
alter table commissions alter column new_sales        type numeric(14,2);
alter table commissions alter column old_bonus        type numeric(14,2);
alter table commissions alter column additional_bonus type numeric(14,2);
alter table overtime alter column rate_per_hour type numeric(14,2);
alter table overtime alter column amount        type numeric(14,2);

-- clear synthetic sample rows from the initial migration
delete from salary_structures where employee_id like 'emp-%';
delete from employees where id like 'emp-%';

-- ---- employees ---------------------------------------------------------------
insert into employees (id,name,email,department_id,team_id,designation,status,on_probation,joined_on,bank,account,account_title,cnic,city,note) values
  ('emp-001','Muhammad Yahya','muhammad.yahya@pdc.com.pk','dept-sales','team-sales-field','Marketing Manager','active'::employee_status,false,'2024-01-01','Bank Alfalah','04251008741041','Muhammad Yahya','32302-7476715-5','Lahore',null),
  ('emp-002','Syed Muhammad Aqib Gilani','syed.muhammad.aqib.gilani@pdc.com.pk','dept-sales','team-sales-inside','Outbound Calling Agent','active'::employee_status,false,'2024-03-01','UBL','2212333871025','Syeda Azmat Ara','35202-1680530-3','Lahore',null),
  ('emp-003','Laraib Naeem','laraib.naeem@pdc.com.pk','dept-sales','team-sales-inside','Outbound Calling Agent','active'::employee_status,false,'2024-04-01','HBL','06367900665799','Laraib Naeem','36601-9043008-2','Vehari',null),
  ('emp-004','Abdul Rehman','abdul.rehman@pdc.com.pk','dept-sales','team-sales-inside','Outbound Calling Agent','active'::employee_status,false,'2024-02-01','UBL','0205327017048','Abdul Rehman','33101-2919761-3','Lahore',null),
  ('emp-005','Abdul Rauf','abdul.rauf@pdc.com.pk','dept-sales','team-sales-inside','Outbound Calling Agent','active'::employee_status,false,'2024-01-15','Meezan','PK29MEZN0002490106719217','Abdur Rauf','45206-8219211-5','Lahore',null),
  ('emp-006','Muhammad Nabeel','muhammad.nabeel@pdc.com.pk','dept-sales','team-sales-field','Lead Marketing Executive','active'::employee_status,false,'2023-11-01','Bank Alfalah','55025001903936','Muhammad Nabeel Rashid','35103-9607981-1','Lahore',null),
  ('emp-007','Ammar Bashir','ammar.bashir@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive','active'::employee_status,false,'2024-05-01','UBL','0496293611356','Ammar Bashir','35202-4662861-7','Lahore',null),
  ('emp-008','Muhammad Hasnain','muhammad.hasnain@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive','active'::employee_status,false,'2024-06-01','Jazz Cash','03242482738','Muhammad Hussnain',null,'Lahore',null),
  ('emp-009','Muhammad Bilal','muhammad.bilal@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive','active'::employee_status,false,'2024-04-01','Bank Alfalah','55025001938279','Muhammad Bilal','35301-3660418-7','Lahore','5000 Returned'),
  ('emp-010','Zain Ali','zain.ali@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive','active'::employee_status,false,'2024-03-15','Bank Alfalah','55025001903942','Zain Ali','35202-7794813-7','Lahore',null),
  ('emp-011','Ayesha Khan','ayesha.khan@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive','active'::employee_status,false,'2024-07-01','NBP','PK03NBPA0446004253095786','Ayesha Khan',null,'Lahore',null),
  ('emp-012','Maryam Muneer','maryam.muneer@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive (On-site)','active'::employee_status,false,'2024-08-01','Bank Alfalah','55025002495368','Mariam Muneer',null,'Lahore',null),
  ('emp-013','Maryam Malik','maryam.malik@pdc.com.pk','dept-sales','team-sales-field','Marketing Executive (Remote)','active'::employee_status,false,'2024-05-15','Bank Alfalah','55025001935028','Maryam Asghar',null,'Lahore','Incentive in Salary'),
  ('emp-014','Muskan','muskan@pdc.com.pk','dept-sales','team-sales-field','Social Media / CM','active'::employee_status,false,'2024-09-01','Bank Alfalah','55025002422581','Muskan',null,'Lahore',null),
  ('emp-015','Mubeen Ali Hashmi','mubeen.ali.hashmi@pdc.com.pk','dept-sales','team-sales-field','Video Editor','active'::employee_status,false,'2024-02-01','Nayapay','03027870303','Mubeen Azam','35201-8447487-5','Lahore',null),
  ('emp-016','Awais Munir','awais.munir@pdc.com.pk','dept-estimation','team-est-civil','Senior Estimator','active'::employee_status,false,'2022-06-01','Bank Alfalah','PK14ALFH5502005001930092','Awais Muneer','82702-0340237-1','Kashmir',null),
  ('emp-017','Asad Awan','asad.awan@pdc.com.pk','dept-estimation','team-est-civil','Team Lead','active'::employee_status,false,'2022-09-01','Bank Alfalah','PK82ALFH5502005001930129','Asad Awan','82202-5894945-3','Kashmir',null),
  ('emp-018','Muhammad Uzaer Khan','muhammad.uzaer.khan@pdc.com.pk','dept-estimation','team-est-civil','Associate Estimator','active'::employee_status,false,'2023-03-01','Bank Alfalah','55025002490591','Muhammad Uzair Khan','33302-4467089-3','Toba Tek Singh',null),
  ('emp-019','Rafia','rafia@pdc.com.pk','dept-estimation','team-est-civil','Team Lead','active'::employee_status,false,'2023-01-01','Bank Alfalah','56045001814717','Rafia','35202-1013061-6','Lahore',null),
  ('emp-020','Zain Ali','zain.ali2@pdc.com.pk','dept-estimation','team-est-civil','Estimator','active'::employee_status,false,'2023-06-01','Askari Bank','1050320233008','Zain Ali','35403-8932975-5','Lahore',null),
  ('emp-021','Mohsin Iqbal','mohsin.iqbal@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2023-08-01','Allied Bank','02570010076074780014','Mohsin Iqbal','13503-0951000-3','Lahore',null),
  ('emp-022','Mahnoor Habib','mahnoor.habib@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2023-10-01','Meezan Bank','28020103890699','Mahnoor Habib','35404-2097086-2','Lahore',null),
  ('emp-023','Raazia Babar','raazia.babar@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2024-01-01','HBL','54637000083599','Raazia Babar','35201-8601084-0','Lahore','Clearance Pending'),
  ('emp-024','Firdoos Saleem','firdoos.saleem@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2023-09-01','Soneri Bank','PK70SONE0043020016143497','Firdoos Saleem','35102-5774182-4','Lahore',null),
  ('emp-025','Touqeer Ahmad','touqeer.ahmad@pdc.com.pk','dept-estimation','team-est-civil','Estimator','active'::employee_status,false,'2023-11-01','Bank Alfalah','PK59ALFH5893005001839019','Touqeer Ahmad',null,'Lahore',null),
  ('emp-026','Umar Rashid','umar.rashid@pdc.com.pk','dept-estimation','team-est-civil','Associate Estimator','active'::employee_status,false,'2023-07-01','HBL','11437903101103','Umar','82102-4949348-5','Kashmir',null),
  ('emp-027','Shehroz','shehroz@pdc.com.pk','dept-estimation','team-est-civil','Associate Estimator','active'::employee_status,false,'2024-01-01','Bank Al Habib','PK22BAHL0058007800764050','Shehroz Ahmed',null,'Lahore',null),
  ('emp-028','Haiqa Ashfaq','haiqa.ashfaq@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2024-02-15','National Bank','PK92NBPA1730004243906552','Haiqa Ashfaq',null,'Lahore',null),
  ('emp-029','Arfa Farrukh','arfa.farrukh@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2024-03-01','HBL','59617000022899','Arfa Nisa','35202-4443689-4','Lahore',null),
  ('emp-030','Muneeb ur Rehman','muneeb.ur.rehman@pdc.com.pk','dept-estimation','team-est-civil','Junior Estimator','active'::employee_status,false,'2024-04-15','Allied Bank','7310010094325470','Muneeb Ur Rehman','36502-2649521-1','Lahore',null),
  ('emp-031','Nataliya Tahir','nataliya.tahir@pdc.com.pk','dept-design','team-design-arch','Lead Architect','active'::employee_status,false,'2023-02-01','Bank Alfalah','55025002439612','Nataliya Tahir','35202-3156517-0','Lahore',null),
  ('emp-032','Umar Anayat','umar.anayat@pdc.com.pk','dept-design','team-design-viz','3D Visualizer','active'::employee_status,false,'2023-05-01','Meezan Bank','12760113136573','Kalsoom Bibi','35202-6435055-5','Lahore','Mother''s account'),
  ('emp-033','Muhammad Ibrahim','muhammad.ibrahim@pdc.com.pk','dept-design','team-design-viz','3D Visualizer','active'::employee_status,false,'2023-08-01','HBL','53737000238403','M. Shoaib',null,'Lahore',null),
  ('emp-034','Muhammad Abdullah','muhammad.abdullah@pdc.com.pk','dept-design','team-design-viz','3D Visualizer','active'::employee_status,false,'2026-04-23','Bank Alfalah','55025002450390','Muhammad Abdullah','35202-6363976-3','Lahore','8 Days Salary'),
  ('emp-035','Hassan','hassan@pdc.com.pk','dept-design','team-design-arch','Draftsman','active'::employee_status,false,'2024-06-01','Bank Alfalah','55025002423866','Hassan Raza',null,'Lahore',null),
  ('emp-036','Aadil Fahim','aadil.fahim@pdc.com.pk','dept-admin','team-admin-hr','Manager HR','active'::employee_status,false,'2022-10-01','Bank Alfalah','55025001928836','Aadil Fahim Khan','14301-4157393-7','Kohat',null),
  ('emp-037','Muhammad Hamza','muhammad.hamza@pdc.com.pk','dept-admin','team-admin-hr','HR Executive','active'::employee_status,true,'2026-04-09','Allied Bank','01750010160216610018','Muhammad Hamza','35201-2984321-5','Lahore','New Joining, 22 Days'),
  ('emp-038','Ajmal Ramzan','ajmal.ramzan@pdc.com.pk','dept-admin','team-admin-accounts','Admin','active'::employee_status,false,'2023-01-01','Meezan Bank','5002500960','Muhammad Ajmal Ramzan',null,'Lahore',null),
  ('emp-039','Bilal','bilal@pdc.com.pk','dept-admin','team-admin-accounts','Office Boy','active'::employee_status,false,'2023-06-01','Jazz Cash','03290532676','Muhammad Hussain',null,'Lahore',null),
  ('emp-040','Ammar','ammar@pdc.com.pk','dept-admin','team-admin-accounts','Office Boy','active'::employee_status,false,'2023-06-01','Easypaisa','03126848271','Muhammad Ammar',null,'Lahore',null),
  ('emp-041','Ali Hassan','ali.hassan@pdc.com.pk','dept-admin','team-admin-accounts','Office Boy','active'::employee_status,false,'2026-04-14','Jazz Cash','03056239681','Ali Hassan',null,'Lahore',null),
  ('emp-042','Rukhsana (Cleaner)','rukhsana@pdc.com.pk','dept-admin','team-admin-accounts','Cleaner','active'::employee_status,false,'2023-01-01','Meezan Bank','02050107506833','Muhammad Ajmal Ramzan',null,'Lahore',null)
on conflict (id) do update set
  name=excluded.name, email=excluded.email, department_id=excluded.department_id,
  team_id=excluded.team_id, designation=excluded.designation, status=excluded.status,
  on_probation=excluded.on_probation, joined_on=excluded.joined_on, bank=excluded.bank,
  account=excluded.account, account_title=excluded.account_title, cnic=excluded.cnic,
  city=excluded.city, note=excluded.note;

-- ---- salary structures (full-month) -----------------------------------------
insert into salary_structures (employee_id,basic,medical,travel) values
  ('emp-001',105181.82,11818.18,13000),
  ('emp-002',64727.27,7272.73,8000),
  ('emp-003',48545.45,5454.55,6000),
  ('emp-004',60681.82,6818.18,7500),
  ('emp-005',89000,10000,11000),
  ('emp-006',57371.83,6446.27,7090.9),
  ('emp-007',48545.45,5454.55,6000),
  ('emp-008',40454.55,4545.45,5000),
  ('emp-009',48545.45,5454.55,6000),
  ('emp-010',48545.45,5454.55,6000),
  ('emp-011',32930,3700,4070),
  ('emp-012',32930,3700,4070),
  ('emp-013',49445.16,5555.64,6111.2),
  ('emp-014',28318.18,3181.82,3500),
  ('emp-015',48545.45,5454.55,6000),
  ('emp-016',178000,20000,22000),
  ('emp-017',121363.64,13636.36,15000),
  ('emp-018',82527.27,9272.73,10200),
  ('emp-019',84954.55,9545.45,10500),
  ('emp-020',101136.36,11363.64,12500),
  ('emp-021',60681.82,6818.18,7500),
  ('emp-022',52510,5900,6490),
  ('emp-023',52510,5900,6490),
  ('emp-024',56636.36,6363.64,7000),
  ('emp-025',48545.45,5454.55,6000),
  ('emp-026',60681.82,6818.18,7500),
  ('emp-027',40454.55,4545.45,5000),
  ('emp-028',44500,5000,5500),
  ('emp-029',48545.45,5454.55,6000),
  ('emp-030',48545.45,5454.55,6000),
  ('emp-031',89000,10000,11000),
  ('emp-032',60681.82,6818.18,7500),
  ('emp-033',44500,5000,5500),
  ('emp-034',60681.82,6818.18,7500),
  ('emp-035',28318.18,3181.82,3500),
  ('emp-036',80909.09,9090.91,10000),
  ('emp-037',60681.82,6818.18,7500),
  ('emp-038',44500,5000,5500),
  ('emp-039',28318.18,3181.82,3500),
  ('emp-040',28318.18,3181.82,3500),
  ('emp-041',28317.37,3181.73,3499.9),
  ('emp-042',6472.73,727.27,800);

-- ---- payroll records (April 2026, prorated) ---------------------------------
insert into payroll_records (id,employee_id,month,status,days,contract_gross,basic,medical,travel,gross,taxable,withholding_tax,net) values
  ('pay-emp-001-2026-04','emp-001','2026-04','paid'::payroll_status,30,130000,105181.82,11818.18,13000,130000,118181.82,2500,127500),
  ('pay-emp-002-2026-04','emp-002','2026-04','paid'::payroll_status,30,80000,64727.27,7272.73,8000,80000,72727.27,227.27,79772.73),
  ('pay-emp-003-2026-04','emp-003','2026-04','paid'::payroll_status,30,60000,48545.45,5454.55,6000,60000,54545.45,45.45,59954.55),
  ('pay-emp-004-2026-04','emp-004','2026-04','paid'::payroll_status,30,75000,60681.82,6818.18,7500,75000,68181.82,181.82,74818.18),
  ('pay-emp-005-2026-04','emp-005','2026-04','paid'::payroll_status,30,110000,89000,10000,11000,110000,100000,500,109500),
  ('pay-emp-006-2026-04','emp-006','2026-04','paid'::payroll_status,30,70909,57371.83,6446.27,7090.9,70909,64462.73,144.63,70764.37),
  ('pay-emp-007-2026-04','emp-007','2026-04','paid'::payroll_status,30,60000,48545.45,5454.55,6000,60000,54545.45,45.45,59954.55),
  ('pay-emp-008-2026-04','emp-008','2026-04','paid'::payroll_status,30,50000,40454.55,4545.45,5000,50000,45454.55,0,50000),
  ('pay-emp-009-2026-04','emp-009','2026-04','paid'::payroll_status,30,60000,48545.45,5454.55,6000,60000,54545.45,45.45,59954.55),
  ('pay-emp-010-2026-04','emp-010','2026-04','paid'::payroll_status,30,60000,48545.45,5454.55,6000,60000,54545.45,45.45,59954.55),
  ('pay-emp-011-2026-04','emp-011','2026-04','paid'::payroll_status,30,40700,32930,3700,4070,40700,37000,0,40700),
  ('pay-emp-012-2026-04','emp-012','2026-04','paid'::payroll_status,30,40700,32930,3700,4070,40700,37000,0,40700),
  ('pay-emp-013-2026-04','emp-013','2026-04','paid'::payroll_status,30,61112,49445.16,5555.64,6111.2,61112,55556.36,55.56,61056.44),
  ('pay-emp-014-2026-04','emp-014','2026-04','paid'::payroll_status,30,35000,28318.18,3181.82,3500,35000,31818.18,0,35000),
  ('pay-emp-015-2026-04','emp-015','2026-04','paid'::payroll_status,30,60000,48545.45,5454.55,6000,60000,54545.45,45.45,59954.55),
  ('pay-emp-016-2026-04','emp-016','2026-04','paid'::payroll_status,30,220000,178000,20000,22000,220000,200000,13500,206500),
  ('pay-emp-017-2026-04','emp-017','2026-04','paid'::payroll_status,30,150000,121363.64,13636.36,15000,150000,136363.64,4500,145500),
  ('pay-emp-018-2026-04','emp-018','2026-04','paid'::payroll_status,30,102000,82527.27,9272.73,10200,102000,92727.27,427.27,101572.73),
  ('pay-emp-019-2026-04','emp-019','2026-04','paid'::payroll_status,30,105000,84954.55,9545.45,10500,105000,95454.55,454.55,104545.45),
  ('pay-emp-020-2026-04','emp-020','2026-04','paid'::payroll_status,30,125000,101136.36,11363.64,12500,125000,113636.36,2000,123000),
  ('pay-emp-021-2026-04','emp-021','2026-04','paid'::payroll_status,30,75000,60681.82,6818.18,7500,75000,68181.82,181.82,74818.18),
  ('pay-emp-022-2026-04','emp-022','2026-04','paid'::payroll_status,30,64900,52510,5900,6490,64900,59000,90,64810),
  ('pay-emp-023-2026-04','emp-023','2026-04','paid'::payroll_status,17,64900,29755.67,3343.33,3677.67,36776.67,33433.34,51,36725.67),
  ('pay-emp-024-2026-04','emp-024','2026-04','paid'::payroll_status,30,70000,56636.36,6363.64,7000,70000,63636.36,136.36,69863.64),
  ('pay-emp-025-2026-04','emp-025','2026-04','paid'::payroll_status,30,60000,48545.45,5454.55,6000,60000,54545.45,45.45,59954.55),
  ('pay-emp-026-2026-04','emp-026','2026-04','paid'::payroll_status,30,75000,60681.82,6818.18,7500,75000,68181.82,181.82,74818.18),
  ('pay-emp-027-2026-04','emp-027','2026-04','paid'::payroll_status,30,50000,40454.55,4545.45,5000,50000,45454.55,0,50000),
  ('pay-emp-028-2026-04','emp-028','2026-04','paid'::payroll_status,30,55000,44500,5000,5500,55000,50000,0,55000),
  ('pay-emp-029-2026-04','emp-029','2026-04','paid'::payroll_status,24,60000,38836.36,4363.64,4800,48000,43636.36,36.36,47963.64),
  ('pay-emp-030-2026-04','emp-030','2026-04','paid'::payroll_status,17,60000,27509.09,3090.91,3400,34000,30909.09,25.76,33974.24),
  ('pay-emp-031-2026-04','emp-031','2026-04','paid'::payroll_status,30,110000,89000,10000,11000,110000,100000,500,109500),
  ('pay-emp-032-2026-04','emp-032','2026-04','paid'::payroll_status,30,75000,60681.82,6818.18,7500,75000,68181.82,181.82,74818.18),
  ('pay-emp-033-2026-04','emp-033','2026-04','paid'::payroll_status,30,55000,44500,5000,5500,55000,50000,0,55000),
  ('pay-emp-034-2026-04','emp-034','2026-04','paid'::payroll_status,8,75000,16181.82,1818.18,2000,20000,18181.82,48.48,19951.52),
  ('pay-emp-035-2026-04','emp-035','2026-04','paid'::payroll_status,30,35000,28318.18,3181.82,3500,35000,31818.18,0,35000),
  ('pay-emp-036-2026-04','emp-036','2026-04','paid'::payroll_status,30,100000,80909.09,9090.91,10000,100000,90909.09,409.09,99590.91),
  ('pay-emp-037-2026-04','emp-037','2026-04','paid'::payroll_status,22,75000,44500,5000,5500,55000,50000,133.33,54866.67),
  ('pay-emp-038-2026-04','emp-038','2026-04','paid'::payroll_status,30,55000,44500,5000,5500,55000,50000,0,55000),
  ('pay-emp-039-2026-04','emp-039','2026-04','paid'::payroll_status,30,35000,28318.18,3181.82,3500,35000,31818.18,0,35000),
  ('pay-emp-040-2026-04','emp-040','2026-04','paid'::payroll_status,30,35000,28318.18,3181.82,3500,35000,31818.18,0,35000),
  ('pay-emp-041-2026-04','emp-041','2026-04','paid'::payroll_status,17,34999,16046.51,1802.98,1983.28,19832.77,18029.79,0,19833.33),
  ('pay-emp-042-2026-04','emp-042','2026-04','paid'::payroll_status,30,8000,6472.73,727.27,800,8000,7272.73,0,8000)
on conflict (id) do update set
  status=excluded.status, days=excluded.days, contract_gross=excluded.contract_gross,
  basic=excluded.basic, medical=excluded.medical, travel=excluded.travel,
  gross=excluded.gross, taxable=excluded.taxable,
  withholding_tax=excluded.withholding_tax, net=excluded.net;

-- ---- commissions (sales, separate payout) -----------------------------------
insert into commissions (payroll_record_id,new_sales,old_bonus,additional_bonus) values
  ('pay-emp-001-2026-04',0,0,68750),
  ('pay-emp-002-2026-04',23544,6940,0),
  ('pay-emp-005-2026-04',53098,0,0),
  ('pay-emp-004-2026-04',52820,0,0),
  ('pay-emp-006-2026-04',9508,27727,25798),
  ('pay-emp-007-2026-04',5004,0,0),
  ('pay-emp-010-2026-04',4921,0,0),
  ('pay-emp-011-2026-04',22518,0,0),
  ('pay-emp-008-2026-04',4921,0,0),
  ('pay-emp-009-2026-04',16997,0,0);

-- ---- overtime (estimation, separate payout) ---------------------------------
insert into overtime (payroll_record_id,hours,rate_per_hour,working_days,amount) values
  ('pay-emp-017-2026-04',6.5,553.98,22,3600.87),
  ('pay-emp-018-2026-04',3.5,376.7,22,1318.45),
  ('pay-emp-019-2026-04',5,387.78,22,1938.9),
  ('pay-emp-020-2026-04',2.45,461.65,22,1131.04),
  ('pay-emp-022-2026-04',4.5,239.69,22,1078.61),
  ('pay-emp-024-2026-04',5.3,258.52,22,1370.16),
  ('pay-emp-026-2026-04',13,276.99,22,3600.87),
  ('pay-emp-027-2026-04',5.5,184.66,22,1015.63);

-- ---- operational expenses ----------------------------------------------------
insert into expenses (id,month,department_id,category,label,amount,recurring,vendor) values
  ('exp-2026-04-001','2026-04','dept-estimation','Outsourcing','Outsource',152000,false,null),
  ('exp-2026-04-002','2026-04','dept-admin','Facilities','Office Building Rent',242000,true,null),
  ('exp-2026-04-003','2026-04','dept-admin','Facilities','Alnoor Building Rent',25300,true,null),
  ('exp-2026-04-004','2026-04','dept-admin','Utilities','PTCL 1st Floor',7690,true,null),
  ('exp-2026-04-005','2026-04','dept-admin','Utilities','PTCL 2nd Floor',7700,true,null),
  ('exp-2026-04-006','2026-04','dept-admin','Utilities','Transword Internet PDC',7436,true,null),
  ('exp-2026-04-007','2026-04','dept-admin','Utilities','Transword Internet JU',5633,true,null),
  ('exp-2026-04-008','2026-04','dept-admin','Utilities','Alnoor Internet',1200,true,null),
  ('exp-2026-04-009','2026-04','dept-admin','Utilities','LESCO 1st Floor',21235,true,null),
  ('exp-2026-04-010','2026-04','dept-admin','Utilities','LESCO 2nd Floor',15768,true,null),
  ('exp-2026-04-011','2026-04','dept-admin','Utilities','Alnoor Town Bill',2275,true,null),
  ('exp-2026-04-012','2026-04','dept-admin','Utilities','DHA Water Bill',10000,true,null),
  ('exp-2026-04-013','2026-04','dept-admin','IT & Data','CC Data',124444,false,null),
  ('exp-2026-04-014','2026-04','dept-admin','Software','Office 365, Domains',83500,true,null),
  ('exp-2026-04-015','2026-04','dept-admin','Office','Kitchen Expense',66740,false,null),
  ('exp-2026-04-016','2026-04','dept-admin','Office','Daig (18k/week × 4)',72000,false,null),
  ('exp-2026-04-017','2026-04','dept-admin','Hardware','LCD & Systems',75100,false,null)
on conflict (id) do nothing;
