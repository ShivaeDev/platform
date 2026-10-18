---
"@shivaedev/effect-react": minor
---

### Added

- `authAction` in `client/authAction.ts` binds Better Auth client promises to native action atoms for `useAction`, with pending state and typed returned failures. Rejected promises fail with the exported `AuthActionUnavailable` error; `AuthActionResult` describes the structural client result.
