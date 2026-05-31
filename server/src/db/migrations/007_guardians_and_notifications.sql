-- Guardians, Telegram linking, notifications

create table if not exists guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone_e164)
);

create index if not exists idx_guardians_user_id on guardians(user_id);

create table if not exists guardian_students (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardians(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  notify_on_result boolean not null default false,
  unique (guardian_id, student_id)
);

create index if not exists idx_guardian_students_student on guardian_students(student_id);
create unique index if not exists idx_guardian_students_one_primary
  on guardian_students(student_id)
  where is_primary = true;

create table if not exists guardian_telegram (
  guardian_id uuid primary key references guardians(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_username text,
  linked_at timestamptz not null default now(),
  opt_out boolean not null default false
);

create table if not exists telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists idx_telegram_link_codes_active
  on telegram_link_codes(code)
  where used_at is null;

create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message_text text not null,
  target_type text not null check (target_type in ('all', 'family', 'student')),
  target_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete set null,
  student_id uuid references students(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  broadcast_id uuid references broadcasts(id) on delete set null,
  channel text not null default 'telegram',
  status text not null,
  message_preview text,
  error_detail text,
  attempt_count smallint not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_log_user_created
  on notification_log(user_id, created_at desc);
