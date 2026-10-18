---
"@shivaedev/effect-sql": patch
---

### Changed

- `migratePostgres` rejects loaded migration IDs at or below the latest applied ID that are missing from the ledger with a typed native `MigrationError` (`kind: "BadState"`) naming those IDs; a deployment that relied on silently skipping them now fails. Migrations run in ID order, including with a custom loader.
