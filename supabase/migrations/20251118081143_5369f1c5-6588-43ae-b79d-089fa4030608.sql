-- Add momentum score fields to leads table
alter table leads
  add column if not exists momentum_score int,       -- 0–100
  add column if not exists momentum_trend text,      -- 'rising', 'falling', 'flat'
  add column if not exists momentum_last_calculated timestamptz;