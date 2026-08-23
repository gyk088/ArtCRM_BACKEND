-- step 18
BEGIN;

ALTER TABLE my_user ADD COLUMN certificate_header_text TEXT;

COMMIT;
