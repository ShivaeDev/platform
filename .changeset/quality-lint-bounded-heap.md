---
"@shivaedev/quality": patch
---

### Fixed

- Keep `quality lint` within Node's default heap on large repositories by bounding concurrent rules and releasing package-scoped TypeScript source state after analysis.
