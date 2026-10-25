---
"@shivaedev/platform": minor
---

### Added

- Document mounting the admin route guard over `/admin`, its descendants and its HTML fallback before static SPA serving. Authorization rejections return `Cache-Control: private, no-store`.

### Changed

- Mark every app-host native RPC response `Cache-Control: private, no-store` at the outer response boundary, including mixed batches, typed failures, transport failures and streams.
