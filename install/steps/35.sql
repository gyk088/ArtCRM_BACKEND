-- step 35
-- Квота "справочник художников" (quota_catalog_artists) теперь действует и
-- для менеджера БЕЗ галереи (managed_by_gallery_id IS NULL) — раньше для
-- такого менеджера лимит вообще не проверялся (QuotaService.poolGalleryId
-- возвращал null). Бэкафилл по той же причине, что и в шаге 31 для галерей:
-- не блокировать тех, у кого уже есть художники в справочнике сверх
-- дефолтных 0.
BEGIN;

UPDATE my_user u
SET quota_catalog_artists = COALESCE((
    SELECT COUNT(*) FROM my_artist a WHERE a.user_id = u.id
), 0)
WHERE u.role = 'manager' AND u.managed_by_gallery_id IS NULL;

COMMIT;
