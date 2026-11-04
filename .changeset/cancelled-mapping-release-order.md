---
"@shivaedev/webhooks": patch
---

### Fixed

- Release mapping resources before the receipt transaction finishes, so a retry of a cancelled delivery cannot acquire its resource before the cancelled mapping releases it.
