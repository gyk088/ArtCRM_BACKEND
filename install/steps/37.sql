-- step 37
-- Продажи работ (см. SaleService). Одна работа продаётся один раз —
-- уникальный индекс на art_id. Скидка не хранится, считается из
-- list_price / sale_price при выводе.
BEGIN;

CREATE TABLE my_sale(
    id              uuid DEFAULT uuid_generate_v4(),
    art_id          uuid NOT NULL REFERENCES my_art_object(id),
    -- владелец работы на момент продажи — для правил доступа (как у работ)
    user_id         uuid NOT NULL REFERENCES my_user(id),
    sale_date       date NOT NULL,
    -- цена по прайсу на момент продажи (копия my_art_object.price)
    list_price      numeric(14,2),
    sale_price      numeric(14,2) NOT NULL,
    currency        TEXT NOT NULL,
    -- покупатель из "Контактов"; при удалении контакта продажа остаётся
    contact_id      uuid REFERENCES my_contact(id) ON DELETE SET NULL,
    -- кто оформил продажу
    sold_by         uuid REFERENCES my_user(id),
    comment         TEXT,
    -- доля галереи, % (экран выплат — позже)
    commission_pct  numeric(5,2),
    ctime           timestamp(6) with time zone DEFAULT NOW(),
    utime           timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id),
    CONSTRAINT my_sale_art_unique UNIQUE (art_id),
    CONSTRAINT my_sale_prices_check CHECK (sale_price >= 0 AND (list_price IS NULL OR list_price >= 0)),
    CONSTRAINT my_sale_commission_check CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100))
);

CREATE INDEX my_sale_user_id_idx ON my_sale(user_id);
CREATE INDEX my_sale_sale_date_idx ON my_sale(sale_date);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_sale TO @@DBUSER@@;

COMMIT;
