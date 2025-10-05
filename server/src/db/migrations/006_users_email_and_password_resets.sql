-- Add email to users and create password_resets table
alter table if exists users
  add column if not exists email text unique;

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_resets_user_id on password_resets(user_id);
create index if not exists idx_password_resets_expires on password_resets(expires_at);


