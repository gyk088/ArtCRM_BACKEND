-- step 27
-- Лимит места на диске для пользователя (по умолчанию 5 ГБ). Управляется
-- из Админ-панели для Manager/Artist/Super Admin — см. UserManagementService.
BEGIN;

ALTER TABLE my_user ADD COLUMN storage_limit_bytes BIGINT DEFAULT 5368709120;

COMMIT;
