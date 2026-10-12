### Changed

- The daemon refreshes live followers from committed record hints instead of polling PostgreSQL. Followers retain reconnect resync and bounded read retries; rolled-back writes send no hint.
- Record writes, foreign occupancy and startup migration use effect-sql `transact`. `storage/makeFleetTransaction.ts` exports `makeFleetTransaction`, an Effect that captures the SQL client and in-process reactivity service and returns a table-keyed transaction wrapper.
