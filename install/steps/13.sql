-- step 13
BEGIN;

ALTER TABLE my_file_folder ADD COLUMN parent_id uuid REFERENCES my_file_folder(id);

COMMIT;
