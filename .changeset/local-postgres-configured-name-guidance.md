---
"@shivaedev/local-postgres": patch
---

### Changed

- Setup scripts whose database names come from configured URLs no longer need their own name check; rely on preparation's local-target check. Keep an independent allowlist for setup scripts that own fixed database names.
