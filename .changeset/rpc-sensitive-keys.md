---
"@shivaedev/server": patch
"@shivaedev/admin": patch
---

### Fixed

- Server RPC failures, request diagnostics and traces use the sensitive keys from their own RPC schemas, so registering another RPC cannot redact their public failure tags or messages.
- Admin Jobs schemas mark job payload and failure-detail containers sensitive without marking generic `_tag` or `message` fields sensitive.
