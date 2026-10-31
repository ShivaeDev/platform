---
"@shivaedev/react": minor
---

### Breaking

- React recognizes session rechecks, permission failures and missing routes through the shared error classes. Fail with `Unauthorized`, `Forbidden` and `NotFound` from `@shivaedev/errors/taxonomy.ts` instead of objects or local classes with matching tags. Replace `isUnauthorized` imports from React's `client/resultState.ts` with the taxonomy guard; for a cause, use `Option.exists(Cause.findErrorOption(cause), isUnauthorized)`.
- `authQuery` and `authSession` fail rejected promises with `AuthUnavailable` from `@shivaedev/errors/taxonomy.ts`. Replace `AuthActionUnavailable` imports and error annotations with `AuthUnavailable`, and read its `message` instead of `cause`.

### Fixed

- Query, save, command, loader and live connection failures share one session recheck decision, including identity's native `Unauthorized` errors.
