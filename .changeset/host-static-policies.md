---
"@shivaedev/server": minor
---

### Added

- Configure per-path static cache policy and HTML frame headers through `appHost` assets options.

### Breaking

- Default fingerprinted assets to immutable caching, HTML documents and SPA fallbacks to `no-store`, and unversioned files to `no-cache`. HTML defaults to `frame-ancestors 'none'` and `X-Frame-Options: DENY`, including HEAD, partial and conditional responses. Consumers that need their previous caching or embedding behavior must set `assets.cacheControl` to their cache policy and `assets.documentHeaders` to configure or disable framing restrictions. Manually mounted native static layers retain their behavior.
