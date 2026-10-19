---
"@shivaedev/platform": patch
---

### Fixed

- Host types account for framework-provided `$changes` handlers, so contracts with typed changes streams compose with application handler layers. Hosts without a changes service keep that stream idle. Public configuration handlers leave the reserved stream to the host.
