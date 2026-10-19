---
"@shivaedev/quality": patch
---

### Fixed

- Resolve DOM globals by scope when checking unit tests and their test-support fixtures, so local variables, parameters and destructured bindings named `document` pass while global DOM access is still reported.
