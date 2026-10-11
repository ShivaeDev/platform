### Fixed

- Await React updates in the DOM story fixtures, including the PostgreSQL composition, without filtering console errors. Keep database reset serialization in the shared story semaphore instead of a package-wide Vitest concurrency setting.
