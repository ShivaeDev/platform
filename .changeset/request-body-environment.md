---
"@shivaedev/http": minor
"@shivaedev/server": minor
"@shivaedev/webhooks": patch
---

### Breaking

- `@shivaedev/http`: in `server/boundedBody.ts`, call `readBoundedBody()` instead of `readBoundedBody(request)`. The reader requires the native `HttpServerRequest.HttpServerRequest` in the Effect environment. Native router handlers already provide it; other callers must use `Effect.provideService(HttpServerRequest.HttpServerRequest, request)`.
- `@shivaedev/server`: in `boundedRpcRequest.ts`, replace `boundedRpcRequest(request)` with `yield* boundedRpcRequest()` inside an Effect. Provide the native request through `HttpServerRequest.HttpServerRequest`; the returned request keeps its cached text and array-buffer reads.

### Changed

- `@shivaedev/webhooks`: routes use the bounded body reader through the native request's Effect environment, preserving their body limits and HTTP responses.
