-- Fix figures table to use TEXT for figure_id instead of UUID
ALTER TABLE figures ALTER COLUMN figure_id TYPE TEXT;