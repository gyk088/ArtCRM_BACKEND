-- step 2

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица биографий
CREATE TABLE my_biography (
    id              uuid DEFAULT uuid_generate_v4(),
    user_id         uuid REFERENCES my_user(id),
    biography       TEXT,
    ctime           timestamp(6) with time zone DEFAULT NOW(),
    utime           timestamp(6) with time zone,
    active          boolean DEFAULT false,

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_biography TO @@DBUSER@@;

-- Таблица cv
CREATE TABLE my_cv (
    id           uuid DEFAULT uuid_generate_v4(),
    user_id      uuid REFERENCES my_user(id),
    cv           TEXT,
    ctime        timestamp(6) with time zone DEFAULT NOW(),
    utime        timestamp(6) with time zone,

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_cv TO @@DBUSER@@;


COMMIT;