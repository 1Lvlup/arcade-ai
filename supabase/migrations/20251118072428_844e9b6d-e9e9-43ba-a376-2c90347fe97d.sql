-- Add new columns to objections table for predictive scoring
ALTER TABLE objections
  ADD COLUMN IF NOT EXISTS severity_score INTEGER,
  ADD COLUMN IF NOT EXISTS probability_score INTEGER,
  ADD COLUMN IF NOT EXISTS cluster TEXT,
  ADD COLUMN IF NOT EXISTS persona_pattern TEXT,
  ADD COLUMN IF NOT EXISTS stage_pattern TEXT;

-- Add comments for documentation
COMMENT ON COLUMN objections.severity_score IS 'Severity score from 1-10';
COMMENT ON COLUMN objections.probability_score IS 'Probability score from 1-100 (percentage likelihood)';
COMMENT ON COLUMN objections.cluster IS 'Objection cluster: budget, priority, credibility, status_quo, timing, technical, staffing';
COMMENT ON COLUMN objections.persona_pattern IS 'Free text label for persona pattern';
COMMENT ON COLUMN objections.stage_pattern IS 'Free text label for stage pattern';