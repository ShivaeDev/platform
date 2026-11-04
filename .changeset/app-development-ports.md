---
"@shivaedev/quality": minor
---

### Added

- `appViteConfig` accepts `{ webPort, apiPort }` as its fourth argument. Omitted ports read `VITE_PORT` and `PORT` respectively, falling back to 5173 and 3000.
