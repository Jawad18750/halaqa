-- مستوى الحفظ: current memorization position (تسميع), separate from test naqza
alter table if exists students
  add column if not exists memorization_thumun_id int;

-- القلم: which attempt number this weekly test was (not tied to memorization progress)
alter table if exists sessions
  add column if not exists test_try_number int not null default 1;

alter table if exists sessions
  drop constraint if exists sessions_test_try_number_check;

alter table if exists sessions
  add constraint sessions_test_try_number_check check (test_try_number >= 1);
