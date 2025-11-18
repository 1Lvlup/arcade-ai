-- Enable RLS on objections table
alter table objections enable row level security;

-- Create policy to allow all operations for authenticated users (can be restricted further based on your needs)
create policy "Allow all operations for authenticated users"
  on objections
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');