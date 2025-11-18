-- Enable RLS on deal_metrics table
alter table deal_metrics enable row level security;

-- Allow admins to view all deal metrics
create policy "Admins can view all deal metrics"
  on deal_metrics for select
  using (has_role(auth.uid(), 'admin'::app_role));

-- Allow users to view deal metrics for their tenant's leads
create policy "Users can view deal metrics for their tenant"
  on deal_metrics for select
  using (
    exists (
      select 1 from leads
      where leads.id = deal_metrics.lead_id
      and leads.fec_tenant_id = get_current_user_fec_tenant_id()
    )
  );

-- Allow service to manage deal_metrics
create policy "Service can insert deal metrics"
  on deal_metrics for insert
  with check (
    exists (
      select 1 from leads
      where leads.id = deal_metrics.lead_id
      and leads.fec_tenant_id = get_current_tenant_context()
    )
  );

create policy "Service can update deal metrics"
  on deal_metrics for update
  using (
    exists (
      select 1 from leads
      where leads.id = deal_metrics.lead_id
      and leads.fec_tenant_id = get_current_tenant_context()
    )
  );

create policy "Service can delete deal metrics"
  on deal_metrics for delete
  using (
    exists (
      select 1 from leads
      where leads.id = deal_metrics.lead_id
      and leads.fec_tenant_id = get_current_tenant_context()
    )
  );