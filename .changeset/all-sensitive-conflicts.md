---
"@shivaedev/errors": minor
"@shivaedev/server": minor
"@shivaedev/work-board": minor
---

### Breaking

- `@shivaedev/errors`: `SensitiveFieldConflict` reports all conflicting field names in one failure across an RPC group. Replace reads of the top-level `field`, `publicSchema` and `sensitiveSchema` with iteration over `error.conflicts`, whose entries contain those properties. When constructing the error, pass `{ conflicts }`; its message is derived from the entries.
- `@shivaedev/server`: `appHost` startup failures carry every conflicting field in `SensitiveFieldConflict.conflicts`. Iterate over these entries instead of reading the top-level `field`, `publicSchema` and `sensitiveSchema`; the message lists all entries.
- `@shivaedev/work-board`: `boardLayer` startup failures carry every conflicting field in `SensitiveFieldConflict.conflicts`. Iterate over these entries instead of reading the top-level `field`, `publicSchema` and `sensitiveSchema`; the message lists all entries.
