-- step 48
-- История изменений: кто и когда создал / изменил / удалил запись (работа,
-- ссылка, выставка, отчёт, продажа, контакт, художник, портфолио, заметка,
-- задача, доска задач). Пишется общим хуком на сервере (ChangeLogService),
-- показывается кнопкой «История» в карточках и в журнале галереи.
--   owner_id   — чья запись (user_id сущности): по нему галерея видит журнал
--                своих данных и данных своих менеджеров
--   entity_name — название на момент действия (запись могла быть удалена)
--   meta       — доп. данные для ссылки на запись (например, board_id задачи)
BEGIN;

CREATE TABLE my_change_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    entity_name text,
    action text NOT NULL,
    actor_id uuid REFERENCES my_user(id) ON DELETE SET NULL,
    owner_id uuid REFERENCES my_user(id) ON DELETE CASCADE,
    meta jsonb,
    ctime timestamp(6) with time zone NOT NULL DEFAULT now()
);

CREATE INDEX my_change_log_entity_idx ON my_change_log(entity_type, entity_id, ctime DESC);
CREATE INDEX my_change_log_owner_idx ON my_change_log(owner_id, ctime DESC);
CREATE INDEX my_change_log_actor_idx ON my_change_log(actor_id, ctime DESC);

COMMIT;
