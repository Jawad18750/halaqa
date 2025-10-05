-- Relax attempt_day constraint to allow all weekdays
alter table if exists sessions
  drop constraint if exists sessions_attempt_day_check;

alter table if exists sessions
  add constraint sessions_attempt_day_check
  check (attempt_day in ('sat','sun','mon','tue','wed','thu','fri'));


