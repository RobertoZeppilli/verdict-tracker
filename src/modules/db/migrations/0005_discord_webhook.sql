-- The webhook of `/settings` may be Discord's too (issue #244): the send already speaks to it (#218).
-- SQLite cannot change a check, so the one-row table is rebuilt with the same name and columns.
create table notification_secrets_new (
  singleton integer primary key check (singleton = 1),
  slack_webhook_url text check (
    slack_webhook_url is null
    or slack_webhook_url like 'https://hooks.slack.com/services/_%'
    or slack_webhook_url like 'https://discord.com/api/webhooks/_%'
  ),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
insert into notification_secrets_new (singleton, slack_webhook_url, updated_at)
  select singleton, slack_webhook_url, updated_at from notification_secrets;
drop table notification_secrets;
alter table notification_secrets_new rename to notification_secrets;
