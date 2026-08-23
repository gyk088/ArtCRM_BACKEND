-- step 15
BEGIN;

ALTER TABLE my_art_object ADD COLUMN currency TEXT DEFAULT 'RUB';

COMMIT;
