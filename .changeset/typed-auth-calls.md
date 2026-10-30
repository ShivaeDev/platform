---
"@shivaedev/react": minor
---

### Added

- `authCall` turns a Better Auth client callback into an input-taking Effect for form `onSubmit` handlers.

### Breaking

- `authAction` now fails with `AuthFailure`. Map its closed `code` union to application text instead of reading raw Better Auth error fields or HTTP statuses. Core Better Auth codes pass through; code-less rate limiting becomes `RATE_LIMITED`, and unsupported codes and rejected promises become `UNKNOWN`. Read the original error from `cause`. Replace action error annotations that include `AuthActionUnavailable` with `AuthFailure`; `authQuery` retains its existing failures.
