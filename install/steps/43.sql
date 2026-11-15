-- step 43
-- Задачи в стиле Trello (см. TaskService): доски (проекты), на доске —
-- колонки по статусам задач (справочник), в колонках — карточки задач.
-- Внутри галереи доски, задачи и статусы общие, как работы.
BEGIN;

-- Справочник статусов задач = колонки досок
CREATE TABLE my_task_status(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES my_user(id),
    name        TEXT NOT NULL,
    color       TEXT,
    -- задача в этом статусе считается закрытой (выполнена/отменена):
    -- не подсвечивается как просроченная
    is_final    boolean NOT NULL DEFAULT false,
    order_num   integer,
    ctime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);
CREATE INDEX my_task_status_user_id_idx ON my_task_status(user_id);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_task_status TO @@DBUSER@@;

-- Доски (проекты)
CREATE TABLE my_task_board(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES my_user(id),
    name        TEXT NOT NULL,
    description TEXT,
    updated_by  uuid REFERENCES my_user(id),
    ctime       timestamp(6) with time zone DEFAULT NOW(),
    utime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);
CREATE INDEX my_task_board_user_id_idx ON my_task_board(user_id);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_task_board TO @@DBUSER@@;

-- Задачи. Удалили доску — удаляются и её задачи. Статус, на котором есть
-- задачи, удалить нельзя (RESTRICT) — сначала перенести задачи.
CREATE TABLE my_task(
    id           uuid DEFAULT uuid_generate_v4(),
    board_id     uuid NOT NULL REFERENCES my_task_board(id) ON DELETE CASCADE,
    -- кто создал
    user_id      uuid NOT NULL REFERENCES my_user(id),
    title        TEXT NOT NULL,
    description  TEXT,
    status_id    uuid NOT NULL REFERENCES my_task_status(id) ON DELETE RESTRICT,
    assignee_id  uuid REFERENCES my_user(id) ON DELETE SET NULL,
    due_date     date,
    priority     TEXT NOT NULL DEFAULT 'normal',
    -- позиция карточки внутри колонки
    order_num    integer,
    -- когда задача попала в закрывающий статус (is_final)
    completed_at timestamp(6) with time zone,
    updated_by   uuid REFERENCES my_user(id),
    ctime        timestamp(6) with time zone DEFAULT NOW(),
    utime        timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id),
    CONSTRAINT my_task_priority_check CHECK (priority IN ('low', 'normal', 'high'))
);
CREATE INDEX my_task_board_id_idx ON my_task(board_id);
CREATE INDEX my_task_status_id_idx ON my_task(status_id);
CREATE INDEX my_task_assignee_id_idx ON my_task(assignee_id);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_task TO @@DBUSER@@;

COMMIT;
