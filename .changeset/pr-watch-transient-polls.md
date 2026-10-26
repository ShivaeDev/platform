---
"@shivaedev/pr-watch": patch
---

### Fixed

- Keep continuous PR watches running through network errors, request timeouts, GitHub server failures and rate limits. Report the failure cause, preserve saved observations and retry with bounded backoff, stopping after one hour without a successful round or immediately on permanent failures.
