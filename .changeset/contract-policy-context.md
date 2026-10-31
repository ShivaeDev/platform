---
"@shivaedev/contract": patch
---

### Fixed

- Live subscriptions use policy services provided inside the owning query's handlers layer, just as RPC reads do. Request-local session context takes precedence when the policy checks access to live hints.
