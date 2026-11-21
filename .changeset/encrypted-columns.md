---
"@shivaedev/sql": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/sql`: `encrypted(schema)` from `@shivaedev/sql/encrypted.ts` is a model field for a PostgreSQL `bytea` column that the repository seals with XChaCha20-Poly1305 from Effect's `Aead` before it reaches the database. It reads back as a `Redacted`, has no JSON variant and refuses every encode of its select variant, like `serverOnly`. The column holds a version byte, a random 24-byte nonce and the sealed bytes; a value sealed under another key fails to read with `SchemaError`. Filters leave the field out, and building a repository fails with the new `EncryptedKeyError` when it is the ID column, a bucket, a tuple bucket column or a conflict column, and with `OwnerFieldError` when it is the owner field.
- `@shivaedev/sql`: `ColumnKey` from `@shivaedev/sql/ColumnKey.ts` holds the key that seals encrypted fields. `ColumnKey.fromConfig` reads `COLUMN_ENCRYPTION_KEY`, 32 bytes in base64, once. `makeRepository` loads it while it builds the repository of a model with an encrypted field, so that build also requires `ColumnKey` and fails with `ColumnKeyError`, naming the config value and never its text, when the key is missing or malformed. Repositories of other models keep their types and never read the key.
- `@shivaedev/server`: `appHost` and `workerHost` provide `ColumnKey.fromConfig` beside the `effect/crypto` services, so a repository with encrypted fields works under either host once `COLUMN_ENCRYPTION_KEY` is set. A host whose models declare an encrypted field refuses to start with `ColumnKeyError` when the key is missing or malformed; a host without encrypted fields needs no key.
- `@shivaedev/server`: `appModules` accepts a defined module whose operations yield the host's crypto services, the `effect/crypto` services of `NodeCrypto.layer` (`SecureRandom`, `Digest`, `Mac`, `Kdf`, `Aead`, `Cipher`, `Signature`, `KeyAgreement` and `KeyWrap`) and sql's `ColumnKey`, with no registration providing them. An application deletes a crypto port or Layer it registered only to satisfy the module's service check.
