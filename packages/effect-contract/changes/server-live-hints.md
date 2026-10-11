### Added

- `makeLiveServer` in `makeLiveServer.ts` converts local Reactivity invalidations into native `LiveHint` streams for explicit read keys. Independent helpers keep their resync scopes separate. Each subscription starts with `Resync`; `resync` reconciles every active stream, including after a PostgreSQL listener loses its connection.
