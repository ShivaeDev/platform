### Fixed

- A PostgreSQL connection lost while sending `BEGIN` fails the transaction with its original typed connection failure without crashing the process.
