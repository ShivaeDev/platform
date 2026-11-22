---
"@shivaedev/test-sql": patch
---

### Changed

- A role or server connection budget below the README's formula can make a worker start or a clone open fail now and then with SQLSTATE 53300, and pass on a rerun. This has been so since the Effect 4.1.4 upgrade, which shipped in an earlier release: the worker closes each administrative connection before it opens its next one, but PostgreSQL counts the closed session until its backend exits, a moment later. Before 4.1.4, the close waited for that exit, so such a budget worked. Allow the transient administrative connection that the formula names, and keep it free right after each create or drop. Raise the role's connection limit or `max_connections` to the formula, or run fewer workers (`vitest run --maxWorkers=4`).
