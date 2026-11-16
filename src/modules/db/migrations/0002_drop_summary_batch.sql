-- The Summaries are written through the Messages API while the reader waits (issue #212, ADR 0011):
-- no Message Batch is left to remember. The index goes first, since SQLite refuses to drop a column
-- an index still names.
drop index summaries_batch_id_idx;
alter table summaries drop column batch_id;
