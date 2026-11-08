---
"@shivaedev/react": minor
"@shivaedev/errors": minor
---

### Added

- `@shivaedev/react`: Add shared notice descriptor types at `@shivaedev/react/noticeTypes.ts`.

### Breaking

- `@shivaedev/react`: Move `@shivaedev/react/NoticeContext.ts` to `@shivaedev/react/client/NoticeContext.ts`, `@shivaedev/react/PermissionContext.ts` to `@shivaedev/react/adapters/PermissionContext.ts`, `@shivaedev/react/RecheckContext.ts` to `@shivaedev/react/client/RecheckContext.ts`, `@shivaedev/react/SignOutRegistryContext.ts` to `@shivaedev/react/client/SignOutRegistryContext.ts`, `@shivaedev/react/notices.ts` to `@shivaedev/react/client/notices.ts`, and `@shivaedev/react/sessionRecheck.ts` to `@shivaedev/react/adapters/sessionRecheck.ts`; update imports to the new paths.
- `@shivaedev/react`: Move `@shivaedev/react/adapters/useNoticePublisher.ts` to `@shivaedev/react/client/adapters/useNoticePublisher.ts`, `@shivaedev/react/adapters/usePermissionFailure.ts` to `@shivaedev/react/client/adapters/usePermissionFailure.ts`, `@shivaedev/react/adapters/useQueryNotice.ts` to `@shivaedev/react/client/adapters/useQueryNotice.ts`, and `@shivaedev/react/adapters/useSubmissionCallbacks.ts` to `@shivaedev/react/client/adapters/useSubmissionCallbacks.ts`.
- `@shivaedev/react`: `useLoaderHandoff` in `@shivaedev/react/adapters/useLoaderHandoff.ts` now reads the registry from React context. Change `useLoaderHandoff(registry, atom)` to `useLoaderHandoff(atom)`.
- `@shivaedev/errors`: Error reporting now gives the reporter a copied `Error` with the source message, stack and own annotations, leaving the supplied value unchanged.
