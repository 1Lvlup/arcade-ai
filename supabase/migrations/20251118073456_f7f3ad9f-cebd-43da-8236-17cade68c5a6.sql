-- Create deal_metrics table for tracking lead stage transitions
create table if not exists deal_metrics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  stage text not null,         -- 'New', 'Contacted', 'Discovery', 'Demo', 'Eval', 'Won', 'Lost'
  entered_at timestamptz not null default now(),
  exited_at timestamptz,       -- null until stage is completed
  duration_seconds bigint,     -- calculated on exit
  created_at timestamptz default now()
);

-- Create indexes for efficient querying
create index if not exists idx_deal_metrics_lead_id on deal_metrics(lead_id);
create index if not exists idx_deal_metrics_stage on deal_metrics(stage);