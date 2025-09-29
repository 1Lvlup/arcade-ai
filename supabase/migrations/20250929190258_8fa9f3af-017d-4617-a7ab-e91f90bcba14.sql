-- Clean up any test/broken entries that are causing conflicts
DELETE FROM figures WHERE manual_id = 'short-rabbids';
DELETE FROM chunks_text WHERE manual_id = 'short-rabbids';  
DELETE FROM processing_status WHERE manual_id = 'short-rabbids';
DELETE FROM documents WHERE manual_id = 'short-rabbids';