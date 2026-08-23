-- step 14
BEGIN;

ALTER TABLE my_user ADD COLUMN reset_token TEXT;
ALTER TABLE my_user ADD COLUMN reset_token_expires timestamp(6) with time zone;

COMMIT;
