-- step 41
-- Теги работ — справочник по аналогии со статусами (название + цвет), но
-- у одной работы может быть сколько угодно тегов. Внутри галереи теги
-- общие, как и остальные справочники (см. ArtService.__getRefList).
BEGIN;

CREATE TABLE my_tag(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES my_user(id),
    name        TEXT NOT NULL,
    -- цвет плашки: '#rrggbb' (как у статусов)
    color       TEXT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

CREATE INDEX my_tag_user_id_idx ON my_tag(user_id);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_tag TO @@DBUSER@@;

-- Теги работы. Удалили тег или работу — связи удаляются вместе с ними.
CREATE TABLE my_art_object_tag(
    art_id      uuid NOT NULL REFERENCES my_art_object(id) ON DELETE CASCADE,
    tag_id      uuid NOT NULL REFERENCES my_tag(id) ON DELETE CASCADE,

    PRIMARY KEY (art_id, tag_id)
);

CREATE INDEX my_art_object_tag_tag_id_idx ON my_art_object_tag(tag_id);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_art_object_tag TO @@DBUSER@@;

COMMIT;
