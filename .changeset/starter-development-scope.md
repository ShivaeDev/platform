---
"@shivaedev/create-app": patch
---

### Fixed

- Generated app development-server stories await Vite process termination and drain its output before the test scope ends, including when dependency optimization is still running.
