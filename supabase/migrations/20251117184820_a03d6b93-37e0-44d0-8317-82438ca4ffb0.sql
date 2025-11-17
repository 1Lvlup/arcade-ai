-- Enable UUIDs if not already enabled
create extension if not exists "pgcrypto";

-- COMPANIES
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  website text,
  estimated_game_count int,
  has_vr boolean default false,
  has_redemption boolean default false,
  has_bowling boolean default false,
  downtime_pain_level int, -- 1–10, nullable
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- LEADS
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  name text not null,
  role text,
  email text,
  phone text,
  lead_score int,
  priority_tier text, -- 'A' | 'B' | 'C'
  source text,        -- e.g., 'facebook', 'referral', 'manual'
  last_contacted timestamptz,
  stage text,         -- 'New', 'Researching', 'Contacted', 'Discovery', 'Demo', 'Eval', 'Won', 'Lost'
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CADENCES
create table if not exists cadences (
  id uuid primary key default gen_random_uuid(),
  cadence_name text not null,
  target_persona text, -- 'tech', 'gm', 'owner', etc.
  steps jsonb not null, -- structured steps array
  created_at timestamptz default now()
);

-- SCRIPTS (library of calls/emails/SMS/objection responses)
create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  persona text, -- 'tech', 'gm', 'owner'
  phase text,   -- 'prospecting', 'outreach', 'discovery', 'demo', 'close'
  content text not null,
  created_at timestamptz default now()
);

-- ACTIVITIES (logged calls/emails/notes)
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  activity_type text,   -- 'call', 'email', 'note', 'meeting', etc.
  content text,
  timestamp timestamptz default now()
);

-- SIMPLE INDEXES
create index if not exists idx_leads_company_id on leads(company_id);
create index if not exists idx_leads_stage on leads(stage);
create index if not exists idx_activities_lead_id on activities(lead_id);
create index if not exists idx_activities_company_id on activities(company_id);