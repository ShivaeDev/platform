---
"@shivaedev/mcp": patch
---

### Fixed

- Serve OAuth discovery at the configured issuer's discovery path, including custom and root issuers.
- Keep OAuth metadata rejections in the typed `AuthUnavailable` channel and retain the original cause of configuration, metadata and grant failures.
- Accept case-insensitive bearer authorization schemes.
