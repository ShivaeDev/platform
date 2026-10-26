---
"@shivaedev/work-fleet": patch
---

### Fixed

- Automatically restart lost thread acknowledgements on a fresh thread when no branch, PR or worker output exists, retaining the reservation and area hold. Published work and exhausted automatic restarts still require an orchestrator decision.
