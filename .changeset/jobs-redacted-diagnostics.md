---
"@shivaedev/jobs": patch
---

### Fixed

- Redact scheduled worker logs using the same diagnostic policy as queue workers. Job details sanitize stored failure output and source failure output through the same schema as job listings.
