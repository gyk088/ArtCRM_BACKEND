-- step 8
BEGIN;

ALTER TABLE my_art_object ADD COLUMN avatar_id uuid REFERENCES my_file(id);

COMMIT;
