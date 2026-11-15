-- step 44
-- 1) Статусы, доступные на доске задач. Нет строк для доски — на ней
--    доступны все статусы (так работают доски, созданные до этого шага).
-- 2) Уведомления пользователям (см. NotificationService) — например,
--    «вам назначили задачу».
BEGIN;

CREATE TABLE my_task_board_status(
    board_id   uuid NOT NULL REFERENCES my_task_board(id) ON DELETE CASCADE,
    status_id  uuid NOT NULL REFERENCES my_task_status(id) ON DELETE CASCADE,

    PRIMARY KEY (board_id, status_id)
);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_task_board_status TO @@DBUSER@@;

CREATE TABLE my_notification(
    id          uuid DEFAULT uuid_generate_v4(),
    -- кому
    user_id     uuid NOT NULL REFERENCES my_user(id) ON DELETE CASCADE,
    -- тип: 'task_assigned' и т.п.
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    -- куда перейти по клику (путь во фронтенде)
    link        TEXT,
    -- кто вызвал уведомление
    actor_id    uuid REFERENCES my_user(id) ON DELETE SET NULL,
    is_read     boolean NOT NULL DEFAULT false,
    ctime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);
CREATE INDEX my_notification_user_idx ON my_notification(user_id, is_read, ctime DESC);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_notification TO @@DBUSER@@;

COMMIT;
