---
"@shivaedev/admin": minor
---

### Breaking

- Retrying failed jobs now requires `RetryJobs` (`jobs.retry`) in addition to `ReadJobs` (`jobs.read`). Add `RetryJobs` from `@shivaedev/admin/permissions.ts` to application roles that should keep retrying jobs; roles with only `ReadJobs` can still inspect jobs but receive `Forbidden` when retrying.
