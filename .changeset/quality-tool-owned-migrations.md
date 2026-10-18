---
"@shivaedev/quality": patch
---

### Changed

- Treat numbered `NNNN_snake_case.ts` files directly in `src/server/migrations` as tool-owned in naming checks, including in nested apps, without app configuration. Other files and folders under `migrations` remain checked.
