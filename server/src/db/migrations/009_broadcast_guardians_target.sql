-- Allow guardians target type for custom Telegram broadcasts

alter table broadcasts drop constraint if exists broadcasts_target_type_check;
alter table broadcasts add constraint broadcasts_target_type_check
  check (target_type in ('all', 'family', 'student', 'guardians'));
