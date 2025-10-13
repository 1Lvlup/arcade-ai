-- Add OCR tracking columns to figures table
alter table public.figures
  add column if not exists ocr_status text check (ocr_status in ('pending','processing','success','failed')) default 'pending',
  add column if not exists ocr_error text,
  add column if not exists ocr_updated_at timestamptz;

-- Create indexes for efficient querying of OCR status
create index if not exists idx_figures_ocr_pending on public.figures (ocr_status) where ocr_status in ('pending','failed');
create index if not exists idx_figures_manual_missing_ocr on public.figures (manual_id) where ocr_status <> 'success' or ocr_text is null;

-- Trigger to set default status for new figures
create or replace function public.figures_set_default_status()
returns trigger 
language plpgsql 
security definer
set search_path = public
as $$
begin
  if new.ocr_status is null then 
    new.ocr_status := 'pending'; 
  end if;
  return new;
end $$;

drop trigger if exists trg_figures_default_status on public.figures;
create trigger trg_figures_default_status 
  before insert on public.figures
  for each row 
  execute procedure public.figures_set_default_status();