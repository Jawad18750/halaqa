alter table if exists students
  alter column qr_token set default replace(gen_random_uuid()::text, '-', '');
