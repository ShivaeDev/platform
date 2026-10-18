---
"@shivaedev/test-story": minor
---

### Added

- Fake HTTP services expose `stall`, `replyOnce`, `releaseOnArrival` and `fault` controls for body stalls, raw byte and iterable chunk replies, automatic hold release on route arrival, and faults injected into arrived requests or replies in flight. `FakeHttpReply.chunks` accepts string or byte iterables, and the exported `FakeHttpFault` describes status, pre-header drop and mid-body reset faults. Controls validate route names, narrate through the story and clean up with its scope.
