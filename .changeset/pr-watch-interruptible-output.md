---
"@shivaedev/pr-watch": patch
---

### Fixed

- Allow shutdown to interrupt pending transition output callbacks without saving the undelivered snapshot, so the transition remains available on restart.
- Preserve stop emission errors as typed failures, including when polling fails.
