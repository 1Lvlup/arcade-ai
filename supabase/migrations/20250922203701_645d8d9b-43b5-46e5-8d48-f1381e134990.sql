-- Clean up failed processing files
DELETE FROM figures WHERE manual_id IN ('king-kong-of-skull-island', 'space-invaders-frenzy');
DELETE FROM chunks_text WHERE manual_id IN ('king-kong-of-skull-island', 'space-invaders-frenzy');  
DELETE FROM documents WHERE manual_id IN ('king-kong-of-skull-island', 'space-invaders-frenzy');