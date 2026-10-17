### Fixed

- A generated app registers producer queues and their dead-letter queues through `effect-pg-boss` queue definitions. Note writes enqueue independently after their transaction and log queue failures without failing the saved write; the starter no longer supplies a transactional database adapter.
