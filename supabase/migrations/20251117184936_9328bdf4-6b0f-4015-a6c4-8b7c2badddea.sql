-- Add tenant support to CRM tables
alter table companies add column if not exists fec_tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid;
alter table leads add column if not exists fec_tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid;
alter table cadences add column if not exists fec_tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid;
alter table scripts add column if not exists fec_tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid;
alter table activities add column if not exists fec_tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid;

-- Enable RLS on all CRM tables
alter table companies enable row level security;
alter table leads enable row level security;
alter table cadences enable row level security;
alter table scripts enable row level security;
alter table activities enable row level security;

-- RLS Policies for COMPANIES
create policy "Users can view companies for their tenant"
  on companies for select
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can insert companies for their tenant"
  on companies for insert
  with check (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can update companies for their tenant"
  on companies for update
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Admins can delete companies for their tenant"
  on companies for delete
  using (has_role(auth.uid(), 'admin'::app_role) and fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies for LEADS
create policy "Users can view leads for their tenant"
  on leads for select
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can insert leads for their tenant"
  on leads for insert
  with check (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can update leads for their tenant"
  on leads for update
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Admins can delete leads for their tenant"
  on leads for delete
  using (has_role(auth.uid(), 'admin'::app_role) and fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies for CADENCES
create policy "Users can view cadences for their tenant"
  on cadences for select
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can insert cadences for their tenant"
  on cadences for insert
  with check (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can update cadences for their tenant"
  on cadences for update
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Admins can delete cadences for their tenant"
  on cadences for delete
  using (has_role(auth.uid(), 'admin'::app_role) and fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies for SCRIPTS
create policy "Users can view scripts for their tenant"
  on scripts for select
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can insert scripts for their tenant"
  on scripts for insert
  with check (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can update scripts for their tenant"
  on scripts for update
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Admins can delete scripts for their tenant"
  on scripts for delete
  using (has_role(auth.uid(), 'admin'::app_role) and fec_tenant_id = get_current_user_fec_tenant_id());

-- RLS Policies for ACTIVITIES
create policy "Users can view activities for their tenant"
  on activities for select
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can insert activities for their tenant"
  on activities for insert
  with check (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Users can update activities for their tenant"
  on activities for update
  using (fec_tenant_id = get_current_user_fec_tenant_id());

create policy "Admins can delete activities for their tenant"
  on activities for delete
  using (has_role(auth.uid(), 'admin'::app_role) and fec_tenant_id = get_current_user_fec_tenant_id());