---
"@shivaedev/server": patch
---

### Fixed

- A development trace write that finds the store held by another writer, such as an application's other process or a SQLite viewer with an open transaction, no longer fails the host's shutdown with `database is locked`. The recorder waits for the store on its maintenance clock for a little over a second, then drops that batch and logs one warning naming the file and the number of spans dropped; later drops stay quiet until a write succeeds. Any other write failure still fails shutdown as before.
- A development trace recorder that cannot open its store because another writer holds it fails start-up, as before, with an error that names the store's file and says another writer holds it.
- When a recorder deletes old runs with `PLATFORM_TRACE_INDEXED_ATTRIBUTES` set, it finds each deleted span's indexed attributes through an index instead of scanning every stored attribute.
