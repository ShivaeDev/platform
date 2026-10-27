---
"@shivaedev/contract": minor
---

### Breaking

- Rename `@shivaedev/effect-contract` to `@shivaedev/contract`. Change dependency declarations and imports from `@shivaedev/effect-contract/...` to `@shivaedev/contract/...`.
- Move `errors/taxonomy.ts` and `errors/rejectedField.ts` to `@shivaedev/errors`. Import the failure classes from `@shivaedev/errors/taxonomy.ts` and `rejectedField` from `@shivaedev/errors/rejectedField.ts`.

### Added

- `publicConfig(schema)` from `publicConfig.ts`, the public client configuration contract that lived in `@shivaedev/platform/rpc/publicConfig.ts`.
