-- step 7
BEGIN;

CREATE TABLE my_file_folder(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid REFERENCES my_user(id),
    name        TEXT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_file_folder TO @@DBUSER@@;

ALTER TABLE my_file ADD COLUMN folder_id uuid REFERENCES my_file_folder(id);


COMMIT;
