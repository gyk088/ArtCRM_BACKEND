-- step 36
-- Биографии и резюме переезжают из localStorage браузера на сервер
-- (см. TextDocumentService). Таблицы my_biography / my_cv созданы ещё в
-- шаге 2, но в них не было названия документа и права на удаление.
BEGIN;

ALTER TABLE my_biography ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE my_cv ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS my_biography_user_id_idx ON my_biography(user_id);
CREATE INDEX IF NOT EXISTS my_cv_user_id_idx ON my_cv(user_id);

GRANT DELETE ON TABLE my_biography TO @@DBUSER@@;
GRANT DELETE ON TABLE my_cv TO @@DBUSER@@;

COMMIT;
