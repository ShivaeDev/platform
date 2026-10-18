### Changed

- `PgBossError` has a message that names the operation, the queue and the original error's class and code, such as a PostgreSQL SQLSTATE, without the redacted original message. A registration failure names the queue it was preparing.
