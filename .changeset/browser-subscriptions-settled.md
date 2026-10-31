---
"@shivaedev/test-story": minor
"@shivaedev/contract": minor
---

### Added

- Browser readouts expose each subscription opening's state and an Effect that waits for all openings to receive a first response or a tagged refusal, without polling.
- Contract clients accept a session identity protocol factory so custom transports can follow sign-in and sign-out.

### Breaking

- `browserReads().protocol` is now a session identity protocol factory. Continue passing it directly to `makeClient`; native Layer consumers must call `observed.protocol(undefined)` for an anonymous client, or pass the session identity. The same readout counts traffic across session sockets.
