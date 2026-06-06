alter table if exists notification_log
  add column if not exists message_body text,
  add column if not exists batch_id uuid,
  add column if not exists recipient_label text;

update notification_log
set message_body = message_preview
where message_body is null and message_preview is not null;

create index if not exists idx_notification_log_type_created
  on notification_log(user_id, notification_type, created_at desc);

create index if not exists idx_notification_log_batch
  on notification_log(user_id, batch_id, created_at desc)
  where batch_id is not null;
