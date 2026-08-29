-- step 21
-- Возможность показывать цены работ в ссылке в другой валюте, чем они
-- заведены у художника (например, работы в RUB, а ссылка — в EUR).
BEGIN;

ALTER TABLE my_collection ADD COLUMN display_currency TEXT;
ALTER TABLE my_collection ADD COLUMN currency_rate NUMERIC;
ALTER TABLE my_collection ADD COLUMN currency_rounding NUMERIC;

COMMIT;
