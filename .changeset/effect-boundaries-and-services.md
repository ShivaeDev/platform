---
"@shivaedev/quality": minor
---

### Breaking

- Enforce `effect/boundary` across source, tooling and specs: async, await, new Promise, .then, try and throw belong only in `adapters/` and `test-support/` folders at any depth. Use Effect and tagged failures elsewhere. The fixed `adapters/` convention bridges outside libraries to Effect values without consumer configuration.
- Enforce `effect/service-parameters`: exported functions and public methods read services from Effect's environment, including aliased and wrapped implementation shapes. Effect and Stream requirements, service implementation methods and Layer constructors are accepted; only `test-support/` is exempt. Adapters still follow this rule and ambient runtime bans. Both rules refuse config exceptions and inline suppressions. Consumers adopting the upgrade record existing debt with `quality baseline write --rule effect/boundary` and `quality baseline write --rule effect/service-parameters`.
