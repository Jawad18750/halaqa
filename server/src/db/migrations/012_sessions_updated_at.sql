-- sessions.updated_at is used when editing attempt time and in backup restore
alter table if exists sessions
  add column if not exists updated_at timestamptz;

update sessions
set updated_at = coalesce(attempt_at, created_at)
where updated_at is null;

alter table if exists sessions
  alter column updated_at set default now();

alter table if exists sessions
  alter column updated_at set not null;
