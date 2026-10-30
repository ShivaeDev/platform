---
"@shivaedev/errors": patch
"@shivaedev/identity": patch
---

### Fixed

- Report failures and defects masked by `rpcBoundary` through Effect's error reporters at Error severity with diagnostic redaction before returning the rejection.
- Log boundary-masked RPC failures once at ERROR with their redacted stack; keep declared rejections at INFO.
