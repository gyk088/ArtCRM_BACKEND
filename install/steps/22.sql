-- step 22
-- Ручная сортировка файлов и папок (drag&drop в файловом менеджере) —
-- порядок хранится явным полем, а не выводится из даты создания.
BEGIN;

ALTER TABLE my_file ADD COLUMN order_num INTEGER;
ALTER TABLE my_file_folder ADD COLUMN order_num INTEGER;

-- Бэкафилл: текущий видимый порядок (по ctime) фиксируем как order_num,
-- чтобы после миграции ничего не «перемешалось» для существующих данных.
-- Разбивка по (user_id, folder_id)/(user_id, parent_id) — порядок независим
-- для каждой папки (и для корня).
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, folder_id ORDER BY ctime
  ) - 1 AS rn
  FROM my_file
)
UPDATE my_file f
SET order_num = numbered.rn
FROM numbered
WHERE f.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, parent_id ORDER BY ctime
  ) - 1 AS rn
  FROM my_file_folder
)
UPDATE my_file_folder ff
SET order_num = numbered.rn
FROM numbered
WHERE ff.id = numbered.id;

COMMIT;
