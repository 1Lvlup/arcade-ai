-- Clean up Willy Wonka manual
DELETE FROM figures WHERE manual_id = 'willy-wonka';
DELETE FROM chunks_text WHERE manual_id = 'willy-wonka';  
DELETE FROM documents WHERE manual_id = 'willy-wonka';