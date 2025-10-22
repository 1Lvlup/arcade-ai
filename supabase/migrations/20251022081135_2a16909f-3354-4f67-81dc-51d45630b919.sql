
-- Delete duplicate Down the Clown manuals, keeping only the combined version
-- Keep: down-the-clown-combined-10-21-25-current
-- Delete: down-the-clown, down-the-clown-1761068343331

-- Delete chunks for duplicate manuals
DELETE FROM chunks_text 
WHERE manual_id IN ('down-the-clown', 'down-the-clown-1761068343331');

-- Delete figures for duplicate manuals
DELETE FROM figures 
WHERE manual_id IN ('down-the-clown', 'down-the-clown-1761068343331');

-- Delete documents for duplicate manuals
DELETE FROM documents 
WHERE manual_id IN ('down-the-clown', 'down-the-clown-1761068343331');

-- Delete manual pages for duplicate manuals
DELETE FROM manual_pages 
WHERE manual_id IN ('down-the-clown', 'down-the-clown-1761068343331');

-- Delete processing status for duplicate manuals
DELETE FROM processing_status 
WHERE manual_id IN ('down-the-clown', 'down-the-clown-1761068343331');

-- Delete manual metadata for duplicate manuals
DELETE FROM manual_metadata 
WHERE manual_id IN ('down-the-clown', 'down-the-clown-1761068343331');
