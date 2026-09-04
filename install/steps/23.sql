-- step 23
-- Возможность отключить инструменты публичной страницы ссылки —
-- сортировку по цене и фильтр по художникам (по умолчанию включены).
BEGIN;

ALTER TABLE my_collection ADD COLUMN show_price_sort BOOLEAN DEFAULT true;
ALTER TABLE my_collection ADD COLUMN show_artist_filter BOOLEAN DEFAULT true;

COMMIT;
