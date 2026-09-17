-- step 28
-- Группировка ссылок (my_collection) по папкам — та же модель, что и у
-- файлового менеджера (my_file_folder): вложенные папки + ручной порядок
-- (order_num) для drag&drop.
BEGIN;

CREATE TABLE my_collection_folder(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid REFERENCES my_user(id),
    name        TEXT,
    parent_id   uuid REFERENCES my_collection_folder(id),
    order_num   INTEGER,
    ctime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_collection_folder TO @@DBUSER@@;

ALTER TABLE my_collection ADD COLUMN folder_id uuid REFERENCES my_collection_folder(id);
ALTER TABLE my_collection ADD COLUMN order_num INTEGER;

COMMIT;
