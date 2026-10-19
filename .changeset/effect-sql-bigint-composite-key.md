---
"@shivaedev/effect-sql": patch
---

### Fixed

- Repository writes to a table whose composite key includes a `bigint` column no longer fail with "Do not know how to serialize a BigInt"; their item keys encode each `bigint` key value as its decimal string, the same way a single-column `bigint` key is encoded.
