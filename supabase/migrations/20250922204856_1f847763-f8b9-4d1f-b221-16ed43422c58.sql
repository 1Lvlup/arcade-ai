-- Clean up orphaned documents (those without chunks)
DELETE FROM documents 
WHERE manual_id IN ('king-kong-of-skull-island', 'willy-wonka') 
AND manual_id NOT IN (SELECT DISTINCT manual_id FROM chunks_text);