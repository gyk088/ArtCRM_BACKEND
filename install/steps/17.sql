-- step 17
BEGIN;

ALTER TABLE my_art_object ADD COLUMN imported BOOLEAN DEFAULT false;
ALTER TABLE my_collection ADD COLUMN imported BOOLEAN DEFAULT false;

COMMIT;
