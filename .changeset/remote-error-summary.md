---
"@shivaedev/http": patch
"@shivaedev/jobs": patch
---

### Fixed

- Remote HTTP failures carry a readable message naming the status, method, host and path without query strings, headers or bodies.
- Failed jobs record the error message or a summary of its fields with sensitive values redacted, beside the error tag.
