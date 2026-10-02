-- step 34
-- Счётчики просмотров публичной ссылки (my_collection): общее количество
-- открытий + количество уникальных посетителей. Храним лог открытий, а не
-- просто два counter-поля на my_collection — так уникальность считается
-- честно, через COUNT(DISTINCT visitor_key), без гонок при параллельных
-- инкрементах и с возможностью позже строить статистику по времени.
BEGIN;

CREATE TABLE my_collection_view(
    id             uuid DEFAULT uuid_generate_v4(),
    collection_id  uuid REFERENCES my_collection(id) ON DELETE CASCADE,
    visitor_key    TEXT NOT NULL,
    ctime          timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);
CREATE INDEX idx_collection_view_collection_id ON my_collection_view(collection_id);
GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_collection_view TO @@DBUSER@@;

COMMIT;
