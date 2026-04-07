-- step 4
BEGIN;

ALTER TABLE my_art_object ADD COLUMN description TEXT;
 
CREATE TABLE my_link(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid REFERENCES my_user(id),
    link        TEXT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),
    description TEXT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_link TO @@DBUSER@@;

CREATE TABLE my_art_object_link(    
    art_id      uuid REFERENCES my_art_object(id), 
    link_id     uuid REFERENCES my_link(id),

    PRIMARY KEY (art_id, link_id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_art_object_link TO @@DBUSER@@;


COMMIT;
