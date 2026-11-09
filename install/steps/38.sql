-- step 38
-- Сохраняемые отчёты (см. ReportService). У каждого отчёта своя валюта
-- и своя таблица курсов — отчёт, сформированный однажды, не меняется
-- задним числом от новых курсов.
BEGIN;

CREATE TABLE my_report(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid NOT NULL REFERENCES my_user(id),
    name        TEXT NOT NULL,
    -- тип отчёта; пока только 'sales'
    type        TEXT NOT NULL DEFAULT 'sales',
    -- валюта, в которой формируется отчёт
    currency    TEXT NOT NULL,
    -- фильтры отчёта: период, художники, скидка, цена и т.п.
    filters     jsonb NOT NULL DEFAULT '{}'::jsonb,
    ctime       timestamp(6) with time zone DEFAULT NOW(),
    utime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

CREATE INDEX my_report_user_id_idx ON my_report(user_id);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_report TO @@DBUSER@@;

-- Курсы отчёта: сколько единиц валюты отчёта стоит 1 единица currency
CREATE TABLE my_report_rate(
    report_id   uuid NOT NULL REFERENCES my_report(id) ON DELETE CASCADE,
    currency    TEXT NOT NULL,
    rate        numeric(18,6) NOT NULL,

    PRIMARY KEY (report_id, currency),
    CONSTRAINT my_report_rate_positive CHECK (rate > 0)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_report_rate TO @@DBUSER@@;

COMMIT;
