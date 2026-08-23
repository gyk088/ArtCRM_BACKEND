-- step 11
BEGIN;

CREATE TABLE my_link_artist(
    link_id     uuid REFERENCES my_link(id),
    artist_id   uuid REFERENCES my_artist(id),

    PRIMARY KEY (link_id, artist_id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_link_artist TO @@DBUSER@@;

COMMIT;
