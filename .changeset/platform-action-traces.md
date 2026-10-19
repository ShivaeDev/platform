---
"@shivaedev/platform": patch
"@shivaedev/effect-react": minor
---

### Added

- effect-react exports `actionTrace(effect, name?)` from `actionTrace.ts` to group an action's RPC Effects under a fresh trace. Editor saves and create submissions automatically group their save Effects in a `ui.submit` trace. Native HTTP RPC clients send W3C trace context through the host to SQL and job enqueueing; pg-boss worker attempts retain their separate, linked traces.

### Fixed

- Platform appHost preserves incoming W3C `traceparent` context for RPC handling even without an installed tracer or exporter. Request ids stay annotated on the RPC span.
