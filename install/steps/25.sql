-- step 25
-- Раздел "Выставки" — параллельно "Ссылкам" (my_collection), но
-- представляет реальное событие (даты + место) с собственной галереей
-- фото-документации, а не одной обложкой.
BEGIN;

CREATE TABLE my_exhibition(
    id                   uuid DEFAULT uuid_generate_v4(),
    user_id              uuid REFERENCES my_user(id),
    name                 TEXT,
    subtitle             TEXT,
    description          TEXT,
    artist_or_gallery    TEXT,
    venue                TEXT,
    start_date           DATE,
    end_date             DATE,
    avatar_id            uuid REFERENCES my_file(id),
    show_technique       BOOLEAN DEFAULT true,
    show_year            BOOLEAN DEFAULT true,
    show_seria           BOOLEAN DEFAULT true,
    show_media           BOOLEAN DEFAULT true,
    show_location        BOOLEAN DEFAULT true,
    show_price           BOOLEAN DEFAULT true,
    show_price_sort      BOOLEAN DEFAULT true,
    show_artist_filter   BOOLEAN DEFAULT true,
    display_currency     TEXT,
    currency_rate        NUMERIC DEFAULT 1,
    currency_rounding    NUMERIC DEFAULT 1,
    ctime                timestamp(6) with time zone DEFAULT NOW(),
    utime                timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_exhibition TO @@DBUSER@@;

CREATE TABLE my_exhibition_work(
    exhibition_id  uuid REFERENCES my_exhibition(id),
    art_id         uuid REFERENCES my_art_object(id),
    order_num      SMALLINT,

    PRIMARY KEY (exhibition_id, art_id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_exhibition_work TO @@DBUSER@@;

-- Галерея фото самого события (виды экспозиции, открытие и т.п.) —
-- отдельно от обложки (avatar_id) и от изображений самих работ.
CREATE TABLE my_exhibition_photo(
    id             uuid DEFAULT uuid_generate_v4(),
    exhibition_id  uuid REFERENCES my_exhibition(id),
    file_id        uuid REFERENCES my_file(id),
    caption        TEXT,
    order_num      SMALLINT,
    ctime          timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_exhibition_photo TO @@DBUSER@@;

COMMIT;
