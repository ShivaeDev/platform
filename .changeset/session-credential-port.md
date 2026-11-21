---
"@shivaedev/identity": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/identity`: `SessionCredential` from `@shivaedev/identity/client/SessionCredential.ts` is a credential port for clients that keep their own session token, such as a bundled native shell. Like `SessionMemory`, it has `read`, `write` and `clear` Effects that fail with `SessionCredentialUnavailable`; the application supplies one Layer over its shell's secure storage. `sessionCredentialClient(layer)` from `@shivaedev/identity/client/adapters/sessionCredentialClient.ts` is a Better Auth client plugin that sends the stored credential as `Authorization: Bearer` with `credentials: "omit"`, stores the `set-auth-token` header after sign-in and clears the credential on sign-out or a signed-out session check. An answer changes the stored credential only when its request carried the one stored now, so a session check sent before sign-in that answers after it keeps the new credential. `storedCredential` answers the stored credential for `makeClient`'s `bearerToken`, so the socket sends the current one each time it connects.

### Breaking

- `@shivaedev/contract`: `makeClient`'s `bearerToken` is an `Effect.Effect<string | null>` that the client runs each time its socket connects, instead of a fixed string. A credential Effect that answers `null` connects without the authentication frame. Replace `bearerToken: token` with `bearerToken: Effect.succeed(token)`; a native shell passes `Effect.provide(storedCredential, credentialLayer)` from identity.
- `@shivaedev/contract`: `authenticateSocket` from `@shivaedev/contract/socketAuthentication.ts` takes the socket URL, the credential Effect and optional upgrade headers and opens the WebSocket itself, adding `auth=frame` when a credential is sent. Replace `Layer.effect(Socket.Socket, authenticateSocket(token)).pipe(Layer.provide(Socket.layerWebSocket(framedUrl)))` with `Layer.effect(Socket.Socket, authenticateSocket(url, Effect.succeed(token)))` on the URL without `auth=frame`, provided with a `WebSocketConstructor`.
