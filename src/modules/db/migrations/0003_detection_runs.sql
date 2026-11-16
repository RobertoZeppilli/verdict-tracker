-- When each Detection ended (issue #213): with no cron left, opening the Dashboard starts one only if
-- the last is older than the threshold in `docs/DECISIONI.md`. A row per run, never updated.
create table detection_runs (
  finished_at text not null
);
create index detection_runs_finished_at_idx on detection_runs (finished_at);
