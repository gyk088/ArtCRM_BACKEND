-- step 3
BEGIN;


-- Таблица файлов
CREATE TABLE my_file (
    id              uuid DEFAULT uuid_generate_v4(),
    name            VARCHAR(40),
    encoding        VARCHAR(40),
    mimetype        VARCHAR(40),
    ext             VARCHAR(40),
    size            INTEGER,
    ctime           timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_file TO @@DBUSER@@;

COMMENT ON TABLE  my_file      IS 'Таблица файлов';
COMMENT ON COLUMN my_file.size IS 'Размер в байтах';
COMMENT ON COLUMN my_file.ext  IS 'Расширение файла';


COMMIT;