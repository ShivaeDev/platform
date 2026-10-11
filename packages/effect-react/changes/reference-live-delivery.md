### Changed

- The reference PostgreSQL order handlers use the shared server live helper and support composing PostgreSQL change delivery. The reference fixture proves commits from two HTTP server processes and a pg-boss worker, rollback silence, and live resync after listener loss.
