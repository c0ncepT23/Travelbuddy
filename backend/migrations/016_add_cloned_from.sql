-- Migration 016: Add cloned from fields to saved items
ALTER TABLE saved_items
ADD COLUMN cloned_from_journey_id UUID,
ADD COLUMN cloned_from_owner_name TEXT;

