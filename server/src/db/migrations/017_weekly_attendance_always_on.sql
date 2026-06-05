-- Weekly attendance summaries are always enabled for guardian links.
update guardian_students set notify_weekly_attendance = true where notify_weekly_attendance = false;

alter table guardian_students
  alter column notify_weekly_attendance set default true;
