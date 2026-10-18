### Fixed

- Registration creates a queue again, up to six times with a short backoff, when PostgreSQL rolls the creation back as a deadlock victim (SQLSTATE `40P01`). A partitioned queue created while other queues in the schema have traffic no longer fails Layer acquisition.
