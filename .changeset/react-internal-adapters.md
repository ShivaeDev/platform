---
"@shivaedev/react": minor
---

### Breaking

- React hooks under `@shivaedev/react/internal/` now live under `@shivaedev/react/internal/adapters/`. Change imports of `useLatestCallback.ts`, `useNoticePublisher.ts`, `usePermissionFailure.ts`, `useQueryNotice.ts` and `useSubmissionCallbacks.ts` to that directory; their exports and behavior are unchanged.
