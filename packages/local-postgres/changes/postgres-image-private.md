### Changed

- `POSTGRES_IMAGE` is no longer exported. CI starts PostgreSQL natively, so nothing pulls the pinned image before `db:setup` starts the container.
