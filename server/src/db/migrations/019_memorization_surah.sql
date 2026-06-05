-- Some students are tracked at surah level (short surahs), not a specific thumun.
alter table students
  add column if not exists memorization_surah text;
