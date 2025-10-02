-- Users (Sheikhs)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  number int not null,
  name text not null,
  notes text,
  current_naqza int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, number)
);

-- Sessions (Attempts)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  week_start_date date not null,
  attempt_day text not null check (attempt_day in ('sat','sun')),
  mode text not null check (mode in ('naqza','juz')),
  selected_naqza int,
  selected_juz int,
  thumun_id int not null,
  surah_number int,
  hizb int,
  juz int,
  naqza int,
  fatha_prompts int not null default 0,
  taradud_count int not null default 0,
  passed boolean not null,
  score int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_student_date on sessions(student_id, week_start_date);

