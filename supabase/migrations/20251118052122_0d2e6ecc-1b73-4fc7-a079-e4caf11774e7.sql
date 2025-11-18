-- Create objections table if it doesn't exist
create table if not exists objections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  persona text,        -- 'tech', 'gm', 'owner'
  stage text,          -- 'prospecting', 'outreach', 'discovery', 'demo', 'close'
  objection_text text not null,
  root_cause_hypotheses jsonb,  -- array of strings
  primary_response text,
  alternative_frames jsonb,     -- array of strings
  follow_up_questions jsonb,    -- array of strings
  suggested_next_steps jsonb,   -- array of strings
  created_at timestamptz default now()
);

-- Create index for fast lookups by persona and stage
create index if not exists idx_objections_persona_stage
  on objections(persona, stage);