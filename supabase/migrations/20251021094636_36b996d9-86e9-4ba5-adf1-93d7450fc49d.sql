-- Add metadata columns to figures table for comprehensive image tracking
ALTER TABLE public.figures 
ADD COLUMN IF NOT EXISTS figure_label TEXT,
ADD COLUMN IF NOT EXISTS topics TEXT[],
ADD COLUMN IF NOT EXISTS component TEXT,
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add index for efficient topic searching
CREATE INDEX IF NOT EXISTS idx_figures_topics ON public.figures USING GIN(topics);

-- Add index for component searches
CREATE INDEX IF NOT EXISTS idx_figures_component ON public.figures(component);

-- Add comment for documentation
COMMENT ON COLUMN public.figures.figure_label IS 'Human-readable label for the figure (e.g., "Figure 3A", "Diagram 12")';
COMMENT ON COLUMN public.figures.topics IS 'Array of topics/keywords associated with this image';
COMMENT ON COLUMN public.figures.component IS 'Component name or part this image relates to';
COMMENT ON COLUMN public.figures.file_path IS 'Original file path or source reference';