---
"@shivaedev/quality": patch
"@shivaedev/github": patch
"@shivaedev/server": patch
---

### Fixed

- Quality reports HTTP error branches written with `HttpStatus.fromLiteral` outside configured HTTP edges, including comparisons, switch cases and status-list membership.
- GitHub App requests and artifact storage downloads use the shared HTTP status filter while retaining their GitHub error tags and reasons.
- Server OTLP exports use the shared HTTP status filter to reset warning suppression after success and report redacted collector failures.
