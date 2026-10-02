-- step 31
-- Продажа "мест" в галерее: сколько художников можно завести в справочник
-- (my_artist, без входа), сколько из них — с личным кабинетом (my_user,
-- role='artist'), и сколько менеджеров. Квоты выставляются вручную из
-- Админ-панели (см. storage_limit_bytes — тот же принцип, платёжного
-- шлюза нет). Плюс токены пригласительных ссылок регистрации для
-- менеджеров/художников отдельно (см. UserManagementService).
BEGIN;

ALTER TABLE my_user ADD COLUMN quota_catalog_artists INTEGER DEFAULT 0;
ALTER TABLE my_user ADD COLUMN quota_artist_cabinets INTEGER DEFAULT 0;
ALTER TABLE my_user ADD COLUMN quota_managers INTEGER DEFAULT 0;
ALTER TABLE my_user ADD COLUMN manager_invite_token TEXT UNIQUE;
ALTER TABLE my_user ADD COLUMN artist_invite_token TEXT UNIQUE;

-- Бэкафилл для уже существующих галерей: выставляем квоты по фактически
-- уже занятому количеству, чтобы никого не заблокировать задним числом —
-- расширять лимит дальше нужно будет уже вручную из Админ-панели.
UPDATE my_user g SET quota_managers = (
  SELECT COUNT(*) FROM my_user u WHERE u.managed_by_gallery_id = g.id AND u.role = 'manager'
)
WHERE g.role = 'gallery';

UPDATE my_user g SET quota_artist_cabinets = (
  SELECT COUNT(*) FROM my_user u WHERE u.managed_by_gallery_id = g.id AND u.role = 'artist'
)
WHERE g.role = 'gallery';

UPDATE my_user g SET quota_catalog_artists = (
  SELECT COUNT(*) FROM my_artist a
  WHERE a.user_id = g.id
     OR a.user_id IN (SELECT id FROM my_user WHERE managed_by_gallery_id = g.id AND role = 'manager')
)
WHERE g.role = 'gallery';

COMMIT;
