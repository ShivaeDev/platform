---
"@shivaedev/identity": minor
---

### Breaking

- Import `AccountClock` from `server/account-clock/service.ts` and `AccountPreferencesStore` from `server/account-preferences/service.ts`. Register `accountPreferencesStore` from `server/account-preferences/store.ts` instead of `AccountPreferencesStore.layer`; it supplies the yielded preferences repository while retaining one SQL-backed Layer to provide.
- Import `accountRoleSeed` from `server/better-auth/adapters/accountRoleSeed.ts` and `currentSessionContext` from `server/adapters/currentSessionContext.ts`; their signatures and behavior are unchanged.
- Import `permissionRoute` from `server/adapters/permissionRoute.ts` and pass an Effect handler instead of a request callback: `permissionRoute(permission)(handlerEffect)`. Yield `HttpServerRequest.HttpServerRequest` in the handler to read the request. Register the returned Effect directly with `HttpRouter`; import `permissionLayer` from `server/permissionLayer.ts`.
