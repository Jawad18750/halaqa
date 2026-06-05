-- Optional free-text notes from the Sheikh on a test session (shown in Telegram when set).
alter table sessions
  add column if not exists teacher_notes text;
