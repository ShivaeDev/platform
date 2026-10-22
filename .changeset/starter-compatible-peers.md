---
"@shivaedev/create-app": patch
---

### Fixed

- Generate a standalone catalog aligned with the published framework peers for React, router, Vitest and happy-dom. The generated CI command checks peer dependencies before application checks so incompatible pins fail the published-starter gate.
