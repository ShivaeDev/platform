---
"@shivaedev/react": minor
---

### Breaking

- Import `queryRoute` from `@shivaedev/react/adapters/queryRoute.ts` instead of `@shivaedev/react/queryRoute.ts`.
- Import `permissionGuard`, `PermissionGuardOptions` and `PermissionGuardContext` from `@shivaedev/react/adapters/permissionGuard.ts` instead of `@shivaedev/react/permissionGuard.ts`.
- Import `PermissionBoundary`, `PermissionBoundaryError`, `PermissionBoundaryProps` and `useCan` from `@shivaedev/react/adapters/permissionBoundary.ts` instead of `@shivaedev/react/client/permissionBoundary.ts`.
- Import `screenPending` and `ScreenPendingOptions` from `@shivaedev/react/adapters/screenPending.ts` instead of `@shivaedev/react/client/screenPending.ts`.
- Import `useSignOut` from `@shivaedev/react/client/adapters/useSignOut.ts` instead of `@shivaedev/react/client/useSignOut.ts`.
- Direct imports of `useLoaderHandoff` move from `@shivaedev/react/internal/useLoaderHandoff.ts` to `@shivaedev/react/adapters/useLoaderHandoff.ts`. Direct imports of `keepLoaderQuery`, `acceptLoaderQuery` and `pendingLoaderQuery` move from `@shivaedev/react/internal/queryHandoff.ts` to `@shivaedev/react/adapters/queryHandoff.ts`.
- Import `Forbidden` and `ForbiddenProps` from `@shivaedev/react/adapters/Forbidden.ts` instead of `@shivaedev/react/client/Forbidden.ts`.
