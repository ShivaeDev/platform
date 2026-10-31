---
"@shivaedev/quality": patch
---

### Fixed

- Accept runners in `entry.ts(x)` browser entry modules alongside `main.ts(x)`, including ambient runtime checks.
- Accept calls to throwing helpers defined in `adapters/`, keeping third-party control flow at the adapter boundary.
- Accept wrappers that supply type arguments to imported helpers in `structure/no-barrel`.
