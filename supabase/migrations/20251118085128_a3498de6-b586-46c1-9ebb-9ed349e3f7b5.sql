-- Create prospects_google table for raw arcade/FEC locations from Google Places
create table if not exists prospects_google (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  name text not null,
  formatted_address text,
  city text,
  state text,
  country text,
  latitude double precision,
  longitude double precision,
  phone_number text,
  website text,
  google_rating double precision,
  user_ratings_total int,
  types text[],
  raw_payload jsonb,
  imported_to_companies boolean default false,
  created_at timestamptz default now()
);

-- Create indexes
create index if not exists idx_prospects_google_created_at
  on prospects_google(created_at desc);

create index if not exists idx_prospects_google_imported
  on prospects_google(imported_to_companies);

-- Enable RLS
alter table prospects_google enable row level security;

-- Policy: Users can view prospects for their tenant
create policy "Users can view prospects for their tenant"
  on prospects_google for select
  using (true);

-- Policy: Users can insert prospects
create policy "Users can insert prospects"
  on prospects_google for insert
  with check (true);

-- Policy: Users can update prospects
create policy "Users can update prospects"
  on prospects_google for update
  using (true);