---
"@shivaedev/server": patch
---

### Fixed

- A development trace write that finds the store held by another writer, such as an application's other process or a SQLite viewer with an open transaction, no longer fails the host's shutdown with `database is locked`. The recorder waits for the store on its maintenance clock for about a second, then drops that batch and logs one warning naming the file and the number of spans dropped; later drops stay quiet until a write succeeds. Any other write failure still fails shutdown as before.
- Closing a development trace recorder with `PLATFORM_TRACE_INDEXED_ATTRIBUTES` set no longer holds the store for seconds or minutes while it deletes old runs: their indexed attributes are found by span instead of by scanning every stored attribute for each deleted span.
