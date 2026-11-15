-- step 45
-- Отметка «расчёт с художником» по продаже (см. SaleService / отчёты):
-- выплачена ли художнику его часть. Хранится на продаже, поэтому видна
-- во всех отчётах, где есть эта продажа.
BEGIN;

ALTER TABLE my_sale ADD COLUMN artist_paid boolean NOT NULL DEFAULT false;
ALTER TABLE my_sale ADD COLUMN artist_paid_at timestamp(6) with time zone;
ALTER TABLE my_sale ADD COLUMN artist_paid_by uuid REFERENCES my_user(id) ON DELETE SET NULL;

COMMIT;
