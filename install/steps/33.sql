-- step 33
-- "Источник" и "Категория" контакта становятся полноценными справочниками
-- (как Медиа/Серия/Статус/Локация) вместо свободного текста — можно
-- заводить свои значения через раздел "Справочник". source/category в
-- my_contact были добавлены только что (шаг 32), реальных данных в них
-- ещё нет — меняем тип колонки прямо, без бэкафилла.
BEGIN;

CREATE TABLE my_contact_source(
    id       uuid DEFAULT uuid_generate_v4(),
    user_id  uuid REFERENCES my_user(id),
    name     TEXT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_contact_source TO @@DBUSER@@;

CREATE TABLE my_contact_category(
    id       uuid DEFAULT uuid_generate_v4(),
    user_id  uuid REFERENCES my_user(id),
    name     TEXT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_contact_category TO @@DBUSER@@;

ALTER TABLE my_contact DROP COLUMN source;
ALTER TABLE my_contact DROP COLUMN category;
ALTER TABLE my_contact ADD COLUMN source uuid REFERENCES my_contact_source(id);
ALTER TABLE my_contact ADD COLUMN category uuid REFERENCES my_contact_category(id);

COMMIT;
