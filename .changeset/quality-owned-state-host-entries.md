---
"@shivaedev/quality": patch
---

### Fixed

- Accept operation parameters supplied exclusively by their service's owned initializer state, including the Layer's Scope.
- Accept object method callbacks typed by foreign host signatures.
- Accept foreign resources received through host callbacks and passed between adapter helpers, while retaining findings for environment services.
- Report function parameters whose return type carries a Context.Service.
- Recognize Rolldown build and watch inputs and entries passed through mapped config arrays, preserving reachability and unused-export findings.
