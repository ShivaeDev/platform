---
"@shivaedev/contract": minor
"@shivaedev/email": minor
"@shivaedev/jobs": minor
"@shivaedev/react": minor
"@shivaedev/test": minor
"@shivaedev/test-kits": minor
"@shivaedev/test-sql": minor
"@shivaedev/test-story": minor
"@shivaedev/vitest-rerun": minor
"@shivaedev/webhooks": minor
---

### Breaking

- `@shivaedev/contract`: Remove `internal/` from module imports. Use `clientActivities.ts` for the former `internal/clientActivity.ts` and `queryProgress.ts` for the former `internal/querySignals.ts`; existing `clientActivity.ts` and `querySignals.ts` imports keep their meaning.
- `@shivaedev/email`: Import development mail rendering from `server/log-mailer/send.ts` instead of `server/internal/log-mailer/send.ts`.
- `@shivaedev/jobs`: Replace `server/internal/` with `server/` in module imports.
- `@shivaedev/react`: Remove `internal/` from module imports, including imports of its adapters.
- `@shivaedev/test`: Remove `internal/` from module imports.
- `@shivaedev/test-kits`: Replace `jobs/internal/` with `jobs/` in module imports.
- `@shivaedev/test-sql`: Replace `server/internal/` with `server/` in module imports.
- `@shivaedev/test-story`: Replace `server/internal/` with `server/` in module imports, including imports of its adapters.
- `@shivaedev/vitest-rerun`: Remove `internal/` from module imports.
- `@shivaedev/webhooks`: Replace `server/internal/` with `server/` in module imports.
