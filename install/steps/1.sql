-- step 1

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица пользователей
CREATE TABLE my_user (
    id              uuid DEFAULT uuid_generate_v4(),
    name            VARCHAR(40),
    surname         VARCHAR(40),
    bdate           DATE,
    avatar          VARCHAR(64),
    country         VARCHAR(100),
    password        VARCHAR(64),
    city            VARCHAR(100),
    sex             VARCHAR(40),
    email           VARCHAR(40),
    phone           VARCHAR(40),
    pin             INTEGER,
    role            VARCHAR(40),
    ctime           timestamp(6) with time zone DEFAULT NOW(),
    utime           timestamp(6) with time zone,
    lat             numeric(23,20),
    lng             numeric(23,20),
    client          VARCHAR(40),
    active          boolean DEFAULT false,
    online          boolean,

    UNIQUE(active, phone),
    UNIQUE(active, email),
    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_user TO @@DBUSER@@;

COMMENT ON TABLE  my_user                 IS 'Таблица пользователей';
COMMENT ON COLUMN my_user.bdate           IS 'День рождения';
COMMENT ON COLUMN my_user.ctime           IS 'Дата создания';
COMMENT ON COLUMN my_user.utime           IS 'Дата редактирования';
COMMENT ON COLUMN my_user.client          IS 'Вид клиента ios, android, web';

-- Таблица сессий
CREATE TABLE my_session (
    user_id      uuid REFERENCES my_user(id),
    token        VARCHAR(256),
    user_agent   VARCHAR(256),
    ip           VARCHAR(32),
    ctime        timestamp(6) with time zone DEFAULT NOW(),
    utime        timestamp(6) with time zone,

    PRIMARY KEY (user_id, token)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_session TO @@DBUSER@@;

COMMENT ON TABLE  my_session            IS 'Таблица сессий';
COMMENT ON COLUMN my_session.token      IS 'токен для авториации';
COMMENT ON COLUMN my_session.user_agent IS 'Заголовок User-Agent';
COMMENT ON COLUMN my_session.ip         IS 'ip адрес';
COMMENT ON COLUMN my_session.ctime      IS 'Дата создания';
COMMENT ON COLUMN my_session.utime      IS 'Дата обновления';




COMMIT;