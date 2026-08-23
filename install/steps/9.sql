-- step 9
BEGIN;

CREATE TABLE my_artist(
    id        uuid DEFAULT uuid_generate_v4(),
    user_id   uuid REFERENCES my_user(id),
    name      TEXT,

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_artist TO @@DBUSER@@;

ALTER TABLE my_art_object ADD COLUMN artist uuid REFERENCES my_artist(id);

COMMIT;
