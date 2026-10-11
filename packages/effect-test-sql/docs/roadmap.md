# Roadmap

- [x] Prepare migrations and optional fixtures once in a closed template database.
- [x] Supply native PostgreSQL services on a shared database with per-test rollback.
- [x] Compose the wrapping transaction with `makeEffectIt`, harness scopes and nested `transact` savepoints.
- [x] Clone isolated databases for real commits and drop them after use.
- [x] Prove the database lifecycle against PostgreSQL and the public contracts with compiler and packed-consumer checks.
- [x] Prepare the approved initial 0.1.0 release metadata.
