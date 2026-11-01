---
"@shivaedev/github": patch
---

### Fixed

- Keep conditional response caches separate for requests with different query parameters. Refresh pagination Link metadata on 304 responses while reusing cached bodies and decoded values, so lists follow the current next page and stop when its Link disappears.
