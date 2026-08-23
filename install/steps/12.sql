-- step 12
BEGIN;

CREATE TABLE my_art_object_image(
    art_id      uuid REFERENCES my_art_object(id),
    file_id     uuid REFERENCES my_file(id),
    order_num   SMALLINT,

    PRIMARY KEY (art_id, file_id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_art_object_image TO @@DBUSER@@;

COMMIT;
