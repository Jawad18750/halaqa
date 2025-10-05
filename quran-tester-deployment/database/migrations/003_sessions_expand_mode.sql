-- Expand sessions schema: attempt_at timestamp, new modes, selection columns
alter table if exists sessions
  add column if not exists attempt_at timestamptz not null default now();

-- Widen mode check to include new modes
alter table if exists sessions
  drop constraint if exists sessions_mode_check;

alter table if exists sessions
  add constraint sessions_mode_check
  check (mode in ('naqza','juz','five_hizb','quarter','half','full'));

-- Add optional selection columns for new modes
alter table if exists sessions
  add column if not exists selected_naqza int,
  add column if not exists selected_juz int,
  add column if not exists selected_five_hizb int,
  add column if not exists selected_quran_quarter int,
  add column if not exists selected_quran_half int;

-- Backfill week_start_date based on attempt_at (Saturday week)
with calc as (
  select id,
         (date_trunc('day', attempt_at at time zone 'UTC')::date - (((extract(dow from attempt_at at time zone 'UTC')::int + 1) % 7)))::date as week_start
  from sessions
)
update sessions s
set week_start_date = c.week_start
from calc c
where s.id = c.id;


