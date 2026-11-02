---
"@shivaedev/create-app": patch
---

### Changed

- Generated apps run lint, typecheck and tests through the shared heavy lock, and rerun failed tests in a fresh process by default. Test reports stay out of Git and generated templates.
