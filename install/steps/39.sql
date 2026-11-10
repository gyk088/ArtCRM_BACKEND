-- step 39
-- Скидка при продаже: в процентах или суммой (см. SaleService).
-- sale_price по-прежнему хранится — его считает сервер из цены работы
-- (list_price, копия my_art_object.price на момент продажи) и скидки.
-- Комиссия галереи больше не используется; колонку commission_pct не
-- удаляем, чтобы не терять уже введённые данные.
BEGIN;

ALTER TABLE my_sale ADD COLUMN discount_type TEXT;
ALTER TABLE my_sale ADD COLUMN discount_value numeric(14,2);
ALTER TABLE my_sale ADD CONSTRAINT my_sale_discount_check CHECK (
    (discount_type IS NULL AND discount_value IS NULL)
    OR (discount_type = 'pct' AND discount_value >= 0 AND discount_value <= 100)
    OR (discount_type = 'amount' AND discount_value >= 0)
);

-- Уже оформленные продажи со скидкой: переносим её как сумму
UPDATE my_sale
SET discount_type = 'amount', discount_value = list_price - sale_price
WHERE list_price IS NOT NULL AND sale_price < list_price;

COMMIT;
