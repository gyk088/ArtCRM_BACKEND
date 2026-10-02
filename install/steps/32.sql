-- step 32
-- Доработка раздела "Контакты": больше полей (email, компания, город,
-- откуда пришёл, категория, день рождения) + связь контакта с работами —
-- уже купленные и те, которыми он интересуется (my_contact_work.status).
BEGIN;

ALTER TABLE my_contact ADD COLUMN email TEXT;
ALTER TABLE my_contact ADD COLUMN company TEXT;
ALTER TABLE my_contact ADD COLUMN city TEXT;
ALTER TABLE my_contact ADD COLUMN source TEXT;
ALTER TABLE my_contact ADD COLUMN category TEXT;
ALTER TABLE my_contact ADD COLUMN birthday DATE;

CREATE TABLE my_contact_work(
    contact_id  uuid REFERENCES my_contact(id),
    art_id      uuid REFERENCES my_art_object(id),
    -- 'purchased' — уже купил, 'interested' — интересуется/хочет купить
    status      TEXT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (contact_id, art_id)
);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_contact_work TO @@DBUSER@@;

COMMIT;
