---
"@shivaedev/discord": minor
---

### Breaking

- Import `DiscordRest` from `@shivaedev/discord/rest/service.ts` and provide `layer` from `@shivaedev/discord/rest/layer.ts` in place of `DiscordRest.layer`. The composed Layer supplies the rate-limit service; continue supplying the native HTTP client, bot token and optional config once at registration.
- Import `DiscordGateway` from `@shivaedev/discord/gateway/service.ts`. Its Layer and `run(handler)` signature stay the same.
- Replace direct uses of the removed `restClient.ts` and `rateLimits.ts` factories with the composed REST Layer and `DiscordRest.request`. Direct gateway integrations import `run` from `gateway/run.ts` and `gatewayConnection` from `adapters/gatewayConnection.ts` instead of `runGateway.ts` and `gatewayConnection.ts`.

### Changed

- REST operations yield their declared dependencies; a dedicated rate-limit service owns pacing state for the registered Layer's lifetime. REST and gateway operations have named tracing spans.
