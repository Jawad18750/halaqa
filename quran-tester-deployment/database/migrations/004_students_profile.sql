-- Add student profile fields
alter table if exists students
  add column if not exists photo_url text,
  add column if not exists date_of_birth date;


