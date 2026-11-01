---
"@shivaedev/browser-check": patch
---

### Fixed

- Launch the cached Chromium executable checked for readiness, including when the separate headless shell is absent.
- Clear previous screenshots before each check so shorter and failed runs leave only their own captures.
