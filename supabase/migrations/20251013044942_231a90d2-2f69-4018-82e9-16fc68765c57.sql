-- Add raw payload tracking to processing_status
ALTER TABLE processing_status ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE processing_status ADD COLUMN IF NOT EXISTS webhook_headers JSONB;

-- Add enhanced metadata and filtering to figures
ALTER TABLE figures
  ADD COLUMN IF NOT EXISTS raw_image_metadata JSONB,
  ADD COLUMN IF NOT EXISTS structured_json JSONB,
  ADD COLUMN IF NOT EXISTS ocr_confidence REAL,
  ADD COLUMN IF NOT EXISTS dropped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dropped_reason TEXT;

-- Add confidence tracking to chunks_text
ALTER TABLE chunks_text ADD COLUMN IF NOT EXISTS text_confidence REAL;