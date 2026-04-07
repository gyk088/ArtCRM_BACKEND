-- step 6
BEGIN;

 
CREATE TABLE my_workspace(
    id          uuid DEFAULT uuid_generate_v4(),
    user_id     uuid REFERENCES my_user(id),
    name        TEXT,
    ctime       timestamp(6) with time zone DEFAULT NOW(),    

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_workspace TO @@DBUSER@@;

CREATE TABLE my_block_text(    
    id            uuid DEFAULT uuid_generate_v4(),
    workspace_id  uuid REFERENCES my_workspace(id),
    text          TEXT,
    column_num    SMALLINT,
    order_num         SMALLINT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_block_text TO @@DBUSER@@;


CREATE TABLE my_block_table(    
    id            uuid DEFAULT uuid_generate_v4(),
    workspace_id  uuid REFERENCES my_workspace(id),
    json              TEXT,
    column_num        SMALLINT,
    order_num         SMALLINT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_block_table TO @@DBUSER@@;

CREATE TABLE my_block_images(    
    id            uuid DEFAULT uuid_generate_v4(),
    workspace_id  uuid REFERENCES my_workspace(id),     
    column_num        SMALLINT,
    order_num         SMALLINT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_block_images TO @@DBUSER@@;

CREATE TABLE my_block_image(    
    block_images_id uuid REFERENCES my_block_images(id),
    file_id         uuid REFERENCES my_file(id),     
    order_num           SMALLINT,

    PRIMARY KEY (block_images_id, file_id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_block_image TO @@DBUSER@@;

CREATE TABLE my_block_links(    
    id            uuid DEFAULT uuid_generate_v4(),
    workspace_id  uuid REFERENCES my_workspace(id),     
    column_num        SMALLINT,
    order_num         SMALLINT,

    PRIMARY KEY (id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_block_links TO @@DBUSER@@;

CREATE TABLE my_block_link(    
    block_links_id  uuid REFERENCES my_block_links(id),
    link_id         uuid REFERENCES my_link(id),     
    order_num       SMALLINT,

    PRIMARY KEY (block_links_id, link_id)
);
GRANT SELECT, UPDATE, INSERT ON TABLE my_block_link TO @@DBUSER@@;


COMMIT;