---
"@shivaedev/test-story": minor
---

### Added

- `ForwardingProxyOptions.localAddress` selects the proxy's source socket address and rejects unavailable addresses during acquisition. `ForwardingProxyOptions.forwardedHops` appends visitor and edge hops after the client's `x-forwarded-for` chain instead of the caller address; fixed `headers` still override the generated chain.
