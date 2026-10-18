---
"@shivaedev/test-story": minor
---

### Added

- `forwardingProxy(upstream, options?)` and `ForwardingProxyOptions` from `@shivaedev/test-story/forwardingProxy.ts` provide a scoped loopback proxy for host stories. It forwards requests and responses, appends the caller to `x-forwarded-for`, and applies the story's configured headers.
