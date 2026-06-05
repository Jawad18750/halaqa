-- القلم: how many times the student has completed full-Quran memorization (default 1 = first journey)
alter table students
  add column if not exists qalam_count int not null default 1;

alter table students
  drop constraint if exists students_qalam_count_check;

alter table students
  add constraint students_qalam_count_check check (qalam_count >= 1 and qalam_count <= 20);
