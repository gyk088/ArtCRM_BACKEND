-- step 26
-- Раздел "Контакты" — персональная адресная книга пользователя (раньше
-- временно хранилась в localStorage браузера на фронтенде, см.
-- ArtCRM_FRONT/src/stores/contact.js).
BEGIN;

CREATE TABLE my_contact(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid REFERENCES my_user(id),
    name        TEXT,
    phone       TEXT,
    messenger   TEXT,
    notes       TEXT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),
    utime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_contact TO @@DBUSER@@;

COMMIT;
