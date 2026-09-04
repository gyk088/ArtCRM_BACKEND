-- step 24
-- Подзаголовок ссылки — короткая подпись под названием на публичной
-- странице (между заголовком и полным описанием).
BEGIN;

ALTER TABLE my_collection ADD COLUMN subtitle TEXT;

COMMIT;
