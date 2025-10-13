-- Step 4: Bulk backfill all manuals and store results
CREATE TEMP TABLE IF NOT EXISTS tmp_backfill_results(manual_id text primary key, result jsonb);

-- Run backfill for each manual
DO $$ 
DECLARE 
  v_manual record;
  v_result jsonb;
BEGIN
  FOR v_manual IN SELECT manual_id FROM public.manual_metadata ORDER BY manual_id
  LOOP
    v_result := public.fn_backfill_for_manual_any(v_manual.manual_id);
    INSERT INTO tmp_backfill_results(manual_id, result) VALUES (v_manual.manual_id, v_result);
  END LOOP;
END $$;

-- Step 5: Mark manuals for reindex if they had updates
UPDATE public.manual_metadata SET requires_reindex = true
WHERE manual_id IN (
  SELECT manual_id FROM tmp_backfill_results WHERE (result->>'total')::int > 0
);