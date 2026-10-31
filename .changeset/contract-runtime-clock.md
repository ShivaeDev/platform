---
"@shivaedev/contract": patch
---

### Fixed

- Live hint and query coalescing delays use the atom runtime's Clock, so TestClock can drive their windows without waiting in real time. Resyncs and registry disposal cancel pending delays.
- Live server resync identities use Effect's Random service, allowing a seeded runtime to reproduce them.
