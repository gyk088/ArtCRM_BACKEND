-- step 46
-- Раздел «Мои художники»:
-- 1) анкета художника (my_artist): фото, контакты, город, год рождения,
--    короткое био и комиссия по умолчанию — она подставляется в отчёты
--    о продажах его работ (индивидуальная комиссия продажи в отчёте
--    по-прежнему важнее, общая комиссия отчёта — запасной вариант);
-- 2) задачу можно привязать к художнику (my_task.artist_id).
BEGIN;

ALTER TABLE my_artist ADD COLUMN avatar_id uuid REFERENCES my_file(id) ON DELETE SET NULL;
ALTER TABLE my_artist ADD COLUMN phone text;
ALTER TABLE my_artist ADD COLUMN email text;
ALTER TABLE my_artist ADD COLUMN messenger text;
ALTER TABLE my_artist ADD COLUMN city text;
ALTER TABLE my_artist ADD COLUMN birth_year smallint;
ALTER TABLE my_artist ADD COLUMN bio text;
ALTER TABLE my_artist ADD COLUMN commission_pct numeric(5,2) CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));

ALTER TABLE my_task ADD COLUMN artist_id uuid REFERENCES my_artist(id) ON DELETE SET NULL;
CREATE INDEX my_task_artist_id_idx ON my_task(artist_id);
CREATE INDEX IF NOT EXISTS my_art_object_artist_idx ON my_art_object(artist);

COMMIT;
