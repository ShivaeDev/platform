---
"@shivaedev/work-fleet": patch
---

### Fixed

- Compare area waiters by stored priority and durable queue order inside transactional admission, so overlapping tasks cannot keep circular queue positions when a brief is revised during dispatch.
