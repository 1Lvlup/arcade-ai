-- Clear stuck processing status for extreme claw manual
DELETE FROM processing_status
WHERE manual_id = 'extrerme-claw' 
  AND status = 'processing'
  AND stage = 'waiting_for_llamacloud'
  AND updated_at < NOW() - INTERVAL '1 hour';

-- Update manual metadata if exists
UPDATE manual_metadata
SET ingest_status = 'ingested',
    updated_at = NOW()
WHERE manual_id = 'extrerme-claw';