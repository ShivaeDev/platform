---
"@shivaedev/test-sql": minor
---

### Added

- `raceWithLock` takes `count: "every blocked session"` for contenders whose SQL runs on other fibers, such as an HTTP server's handlers. The holder then releases once it blocks as many sessions as there are effects.

### Fixed

- `raceWithLock` releases its holder once its own contenders wait, instead of hanging until its timeout when another session also waits on the holder. Each contender's statements now start with a `/* raceWithLock <holder pid>.<index> */` comment.
