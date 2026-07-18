-- Per-slide and per-module generation calls upsert by (experience_id, position)
-- so regeneration can preserve attached media/speakers/scripts by position
-- (Section 6, item 5) instead of blindly appending duplicate rows.
alter table slides add constraint slides_experience_position_key unique (experience_id, position);
alter table training_modules add constraint training_modules_experience_position_key unique (experience_id, position);
