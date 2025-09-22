-- Complete clean slate: Delete ALL manual data
DELETE FROM figures;
DELETE FROM chunks_text; 
DELETE FROM documents;

-- Reset any sequences if needed
-- This gives us a fresh start for the upgraded system