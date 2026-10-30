---
"@shivaedev/quality": patch
---

### Fixed

- Keep plain option objects such as `RequestInit`, including options nested inside Vitest types, out of service-parameter findings when an Effect service uses the same type. Service keys, callable services and method-bearing service implementations remain checked.
