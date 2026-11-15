-- step 40
-- Комиссия галереи в отчётах о продажах (см. ReportService).
-- У отчёта — общая комиссия (my_report.commission_pct), она применяется к
-- каждой продаже. Для конкретной продажи в отчёте можно задать свою
-- (my_report_commission) — тогда сумма считается от неё. Комиссия
-- считается от цены продажи (после скидки).
BEGIN;

ALTER TABLE my_report ADD COLUMN commission_pct numeric(5,2);
ALTER TABLE my_report ADD CONSTRAINT my_report_commission_check
    CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));

CREATE TABLE my_report_commission(
    report_id       uuid NOT NULL REFERENCES my_report(id) ON DELETE CASCADE,
    -- отменили продажу — её индивидуальная комиссия больше не нужна
    sale_id         uuid NOT NULL REFERENCES my_sale(id) ON DELETE CASCADE,
    commission_pct  numeric(5,2) NOT NULL,

    PRIMARY KEY (report_id, sale_id),
    CONSTRAINT my_report_commission_pct_check CHECK (commission_pct >= 0 AND commission_pct <= 100)
);

CREATE INDEX my_report_commission_sale_id_idx ON my_report_commission(sale_id);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_report_commission TO @@DBUSER@@;

COMMIT;
