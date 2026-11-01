---
"@shivaedev/releases": patch
---

### Fixed

- Reject release plans with missing published `workspace:` dependencies, naming the dependent and removed package. Diff planning and checking also reject references to removed packages with registry version ranges. Development-only dependencies and private dependents do not block removal.
