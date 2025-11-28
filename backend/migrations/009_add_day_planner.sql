-- Sprint 3: Day Planner feature
-- Add columns to organize places into days for itinerary planning

-- planned_day: Which day of the trip (1 = Day 1, 2 = Day 2, etc.)
-- NULL means "Unassigned" - place not yet assigned to any day
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS planned_day INTEGER;

-- day_order: Order of the place within that day (for drag-drop reordering)
-- Lower numbers appear first
ALTER TABLE saved_items ADD COLUMN IF NOT EXISTS day_order INTEGER DEFAULT 0;

-- Add index for efficient day-based queries
CREATE INDEX IF NOT EXISTS idx_saved_items_planned_day ON saved_items(trip_group_id, planned_day);
CREATE INDEX IF NOT EXISTS idx_saved_items_day_order ON saved_items(trip_group_id, planned_day, day_order);

-- Add comments for documentation
COMMENT ON COLUMN saved_items.planned_day IS 'Day number for itinerary (1 = Day 1, NULL = Unassigned)';
COMMENT ON COLUMN saved_items.day_order IS 'Order within the day for drag-drop sorting';

