-- step 29
-- Обложка папки в файловом менеджере — своя картинка вместо стандартной
-- иконки папки.
BEGIN;

ALTER TABLE my_file_folder ADD COLUMN avatar_id uuid REFERENCES my_file(id);

COMMIT;
