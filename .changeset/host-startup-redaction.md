---
"@shivaedev/server": patch
---

### Fixed

- Redact preflight log messages, failure causes and annotations before host startup. Preserve typed preflight failures and ordinary startup logs. Direct hosts also apply schema-sensitive fields and configured sensitive keys; deferred hosts use the default redaction policy before their application is constructed.
