alter table if exists guardian_students
  add column if not exists notify_weekly_attendance boolean not null default false;

alter table if exists notification_log
  add column if not exists notification_type text;

create index if not exists idx_notification_log_weekly_attendance
  on notification_log(user_id, student_id, notification_type, created_at desc)
  where notification_type = 'weekly_attendance';
