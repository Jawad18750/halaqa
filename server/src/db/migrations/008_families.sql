-- Optional family grouping for broadcasts

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_families_user_id on families(user_id);

create table if not exists family_students (
  family_id uuid not null references families(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (family_id, student_id)
);

create index if not exists idx_family_students_student on family_students(student_id);
