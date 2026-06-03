alter table if exists students
  add column if not exists qr_token text;

update students
set qr_token = replace(gen_random_uuid()::text, '-', '')
where qr_token is null or qr_token = '';

alter table if exists students
  alter column qr_token set not null;

alter table if exists students
  alter column qr_token set default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists idx_students_qr_token_unique on students(qr_token);

alter table if exists users
  add column if not exists study_days text[] not null default array['sat','sun','mon','tue','wed'],
  add column if not exists holiday_country text default 'LY',
  add column if not exists holiday_overrides jsonb not null default '{}'::jsonb;

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  attendance_date date not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('qr','manual')),
  created_at timestamptz not null default now(),
  unique(student_id, attendance_date)
);

create index if not exists idx_attendance_records_student_date on attendance_records(student_id, attendance_date);
create index if not exists idx_attendance_records_date on attendance_records(attendance_date);
