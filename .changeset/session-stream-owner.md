---
"@shivaedev/contract": patch
---

### Fixed

- Run session-owned streams through their owning registry's client, preserving its transport and headers and ending the streams when the session closes. Streams without a session owner continue to use the caller's client.
