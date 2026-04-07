-- step 4
BEGIN;
 
CREATE TABLE my_media(
    id        uuid DEFAULT uuid_generate_v4(),
    user_id   uuid REFERENCES my_user(id),
    name      TEXT,   

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_media TO @@DBUSER@@;

 
CREATE TABLE my_seria(
    id        uuid DEFAULT uuid_generate_v4(),
    user_id   uuid REFERENCES my_user(id),
    name      TEXT,   

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_seria TO @@DBUSER@@;

CREATE TABLE my_status(
    id        uuid DEFAULT uuid_generate_v4(),
    user_id   uuid REFERENCES my_user(id),
    name      TEXT,   

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_status TO @@DBUSER@@;

CREATE TABLE my_location(
    id        uuid DEFAULT uuid_generate_v4(),
    user_id   uuid REFERENCES my_user(id),
    name      TEXT,

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_location TO @@DBUSER@@;

CREATE TABLE my_art_object(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id      uuid REFERENCES my_user(id),
    name        TEXT,
    technique   TEXT,
    media       uuid REFERENCES my_media(id),
    seria       uuid REFERENCES my_seria(id),
    status      uuid REFERENCES my_status(id),
    location    uuid REFERENCES my_location(id),
    price       NUMERIC(10,2),
    year        SMALLINT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),   
    utime       timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_art_object TO @@DBUSER@@;

CREATE TABLE my_art_object_user(
    user_id  uuid REFERENCES my_user(id),   
    art_id   uuid REFERENCES my_art_object(id),   

    PRIMARY KEY (art_id, user_id)
);

GRANT SELECT, UPDATE, INSERT ON TABLE my_art_object_user TO @@DBUSER@@;


COMMIT;