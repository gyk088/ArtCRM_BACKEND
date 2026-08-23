-- step 19
-- Роли и управление пользователями (Super Admin / Gallery / Manager / Artist)
BEGIN;

ALTER TABLE my_user ADD COLUMN managed_by_gallery_id uuid REFERENCES my_user(id);
ALTER TABLE my_user ADD COLUMN created_by uuid REFERENCES my_user(id);

-- Пользователь без владеющей Галереи (managed_by_gallery_id IS NULL) управляется
-- только Super Admin'ом. Это поле осмысленно только для manager/artist —
-- у gallery/super_admin своей владеющей галереи быть не может, что и
-- закрепляет CHECK ниже на уровне БД.
ALTER TABLE my_user ADD CONSTRAINT my_user_gallery_scope_check
  CHECK (managed_by_gallery_id IS NULL OR role IN ('manager', 'artist'));

CREATE TABLE my_audit_log(
    id              uuid DEFAULT uuid_generate_v4(),
    actor_id        uuid REFERENCES my_user(id),
    target_user_id  uuid REFERENCES my_user(id),
    action          TEXT NOT NULL,
    metadata        JSONB,
    ctime           timestamp(6) with time zone DEFAULT NOW(),

    PRIMARY KEY (id)
);

GRANT SELECT, UPDATE, INSERT, DELETE ON TABLE my_audit_log TO @@DBUSER@@;

-- Кто на самом деле инициировал сессию (Super Admin / Gallery), если это
-- сессия имперсонации, а не обычный логин.
ALTER TABLE my_session ADD COLUMN impersonated_by uuid REFERENCES my_user(id);

COMMIT;
