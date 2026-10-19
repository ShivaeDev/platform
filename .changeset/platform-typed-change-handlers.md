---
"@shivaedev/platform": patch
---

### Fixed

- Host types account for framework-provided `$changes` handlers, so contracts with typed changes streams compose with application handler layers. Without a changes service, hosts preserve an application-supplied change handler or keep the stream idle. Public configuration handlers leave the reserved stream to the host.
