---
"@shivaedev/contract": minor
"@shivaedev/server": patch
"@shivaedev/work-board": minor
"@shivaedev/create-app": patch
---

### Fixed

- `@shivaedev/contract`: Contract groups enforce query read policies automatically in native Effect RPC hosts as well as the application host. A false policy returns `QueryReadDenied` without running the handler. Ordinary queries evaluate their policy once per request.
- `@shivaedev/server`: The application host uses the contract's attached guard and retains its HTTP refusal of WebSocket-only subscriptions.
- `@shivaedev/create-app`: Generated notes test hosts supply the authenticated viewer alongside identity and session data so native contract reads use the fixture's session.

### Breaking

- `@shivaedev/contract`: Remove `guardReads` from `@shivaedev/contract/ReadPolicyGuard.ts`. Serve the contract group directly with `RpcServer`; remove any explicit read-policy Layer unless you use `readPolicyGuardLayer()` to refuse HTTP `$changes` calls with `WebSocketRequired`. `ReadPolicyGuard` is now a defaulted Context reference rather than a service class and requires no provision. Remove its former service type from Layer annotations.
- `@shivaedev/contract`: Custom authentication middleware must supply `CurrentViewer` after session validation and stop calling `authorizeReads`; the contract's attached guard performs that check. Keep `authorizeReads` only for direct handler reruns outside RPC dispatch.
- `@shivaedev/contract`: Ordinary query failures now include `MissingReadPolicy` and `WebSocketRequired` from the attached middleware. `MissingReadPolicy` refuses untyped declarations that omit a policy; `WebSocketRequired` belongs to the optional HTTP subscription restriction. Add these refusals to exhaustive error handlers.
- `@shivaedev/work-board`: Response-wait read callbacks now include contract guard failures in their error type. Add `MissingReadPolicy` and `WebSocketRequired` when handling `waitForResponse` failures.
