-- step 42
-- Заметки (см. NoteService): заголовок, форматированный текст (HTML из
-- редактора), необязательная привязка к художнику, кто и когда создал и
-- последним изменил. Внутри галереи заметки общие, как работы.
BEGIN;

CREATE TABLE my_note(
    id          uuid DEFAULT uuid_generate_v4(),
    -- кто создал
    user_id     uuid NOT NULL REFERENCES my_user(id),
    title       TEXT NOT NULL,
    -- художник из справочника; удалили художника — заметка остаётся без привязки
    artist_id   uuid REFERENCES my_artist(id) ON DELETE SET NULL,
    content     TEXT,
    -- кто последним редактировал
    updated_by  uuid REFERENCES my_user(id),
    ctime       timestamp(6) with time zone DEFAULT NOW(),
    utime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

CREATE INDEX my_note_user_id_idx ON my_note(user_id);
CREATE INDEX my_note_artist_id_idx ON my_note(artist_id);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_note TO @@DBUSER@@;

COMMIT;
