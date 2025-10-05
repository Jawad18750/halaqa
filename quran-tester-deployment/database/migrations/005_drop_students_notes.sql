-- Drop students.notes column (irreversible)
alter table if exists students
  drop column if exists notes;


