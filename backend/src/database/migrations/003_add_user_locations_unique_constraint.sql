ALTER TABLE user_locations
    ADD CONSTRAINT user_locations_user_trip_unique
    UNIQUE (user_id, trip_group_id);
