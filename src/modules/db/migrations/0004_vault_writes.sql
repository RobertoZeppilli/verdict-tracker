-- The last time the vault was written (issue #244): what `/settings` prints beside the field. A cache
-- and not a preference, so it lives here and not in `verdict.json`. One row, overwritten each time.
create table vault_writes (
  singleton integer primary key check (singleton = 1),
  written integer not null check (written >= 0),
  skipped integer not null check (skipped >= 0),
  failed integer not null check (failed >= 0),
  finished_at text not null
);
