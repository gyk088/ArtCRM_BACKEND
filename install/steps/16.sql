-- step 16
BEGIN;

CREATE TABLE my_collection(
    id                 uuid DEFAULT uuid_generate_v4(),
    user_id            uuid REFERENCES my_user(id),
    name               TEXT,
    artist_or_gallery  TEXT,
    description        TEXT,
    avatar_id          uuid REFERENCES my_file(id),
    show_technique     BOOLEAN DEFAULT true,
    show_year          BOOLEAN DEFAULT true,
    show_seria         BOOLEAN DEFAULT true,
    show_media         BOOLEAN DEFAULT true,
    show_location      BOOLEAN DEFAULT true,
    show_price         BOOLEAN DEFAULT true,
    ctime              timestamp(6) with time zone DEFAULT NOW(),
    utime              timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_collection TO @@DBUSER@@;

CREATE TABLE my_collection_work(
    collection_id  uuid REFERENCES my_collection(id),
    art_id         uuid REFERENCES my_art_object(id),
    order_num      SMALLINT,

    PRIMARY KEY (collection_id, art_id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_collection_work TO @@DBUSER@@;

COMMIT;
