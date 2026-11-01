---
"@shivaedev/identity": minor
"@shivaedev/server": minor
"@shivaedev/admin": minor
"@shivaedev/mcp": minor
---

### Breaking

- Identity reads `SessionPolicy` from the Effect environment. Import the service from `@shivaedev/identity/server/SessionPolicy.ts` and construct one `Layer.succeed(SessionPolicy, { origin, provider, roles, streamRevalidationInterval })`, omitting optional fields as needed. Replace `SessionPolicy<TSession>` annotations with `SessionPolicy["Service"]`; provider-specific types remain on `SessionProvider<TSession>`. Remove policy arguments from session middleware constructors, `resolveSession`, `withSessionUser`, `permissionLayer`, `permissionRoute`, session lookup, rechecks and stream revalidation; provide the policy Layer to the composed readers. Profiles and provider accounts are decoded at their middleware boundaries from the shared provider.
- Server's `appHost` `sessions` option accepts that Layer and supplies it to middleware, application routes, sockets and change subscriptions. Wrap the previous policy object in `Layer.succeed(SessionPolicy, policy)`. Remove the session-shape generic from host option and factory types, and remove the policy argument from `hostChanges` and `bearerSocketRpc`.
- Admin uses identity's `SessionPolicy` directly. Replace `AdminSessions` imports and Layers with the identity service, and provide the policy once through the host instead of separately to admin handlers and documents.
- MCP's `mcpRoutes` reads `SessionPolicy` from the environment. Remove its `sessions` option and the session-shape generic from `McpOptions`; `betterAuthMcp` now returns `sessions` as a policy Layer, which can be passed to the host or supplied to MCP routes with `HttpRouter.provideRequest(oauth.sessions)` when the host also serves cookie-authenticated RPC.

### Changed

- Identity operation spans use the `Identity` prefix, including `Identity.resolveSession` and `Identity.betterAuthSession`. Adjust trace queries that used `Platform` or `PlatformRpc` names.
