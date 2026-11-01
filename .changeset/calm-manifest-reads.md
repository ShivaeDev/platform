---
"@shivaedev/quality": minor
---

### Fixed

- Interrupting a scan stops its pending manifest reads.
- Report expected filesystem failures from rules as findings. Report unreadable manifests and manifests removed after discovery under `manifests/valid`; keep optional missing-file lookups unchanged.

### Breaking

- `manifestReader` requires an Effect scope so its reads stop when the owning operation ends. Consumers must create and use the reader within `Effect.scoped`.
