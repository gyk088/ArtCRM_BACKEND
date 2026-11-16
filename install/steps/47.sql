-- step 47
-- Портфолио художника (карточка художника → «Портфолио»): обложка, «о
-- художнике», списки выставок и проекты (текст, фото экспозиции, работы).
-- Выгружается в PDF в браузере и открывается публичной страницей /portfolio/:id.
-- Проекты (sections) хранятся JSON-массивом:
--   [{ id, title, year, text, photos: [{ file_id, caption }], works: [art_id] }]
BEGIN;

CREATE TABLE my_portfolio (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES my_user(id) ON DELETE CASCADE,
    artist_id uuid NOT NULL REFERENCES my_artist(id) ON DELETE CASCADE,
    title text NOT NULL,
    subtitle text,
    cover_id uuid REFERENCES my_file(id) ON DELETE SET NULL,
    bio text,
    bio_photo_id uuid REFERENCES my_file(id) ON DELETE SET NULL,
    exhibitions_solo text,
    exhibitions_group text,
    contacts text,
    sections jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_public boolean NOT NULL DEFAULT true,
    views integer NOT NULL DEFAULT 0,
    ctime timestamp(6) with time zone DEFAULT now(),
    utime timestamp(6) with time zone DEFAULT now()
);

CREATE INDEX my_portfolio_artist_id_idx ON my_portfolio(artist_id);
CREATE INDEX my_portfolio_user_id_idx ON my_portfolio(user_id);

COMMIT;
