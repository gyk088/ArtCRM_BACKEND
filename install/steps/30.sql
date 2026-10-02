-- step 30
-- Совместный доступ к работам внутри галереи: Галерея и её Менеджеры
-- видят и могут редактировать работы друг друга (см. AuthorizationService.
-- gallerySharingScope / ArtService). updated_by — кто последний раз
-- отредактировал работу (user_id остаётся "кто создал").
BEGIN;

ALTER TABLE my_art_object ADD COLUMN updated_by uuid REFERENCES my_user(id);

-- Бэкафилл: для уже существующих работ считаем, что последним редактором
-- был сам создатель (реальной истории правок до этого поля не было).
UPDATE my_art_object SET updated_by = user_id WHERE updated_by IS NULL;

COMMIT;
