---
"@shivaedev/identity": minor
---

### Added

- `betterAuthMount` accepts `{ clientIp: "railway" }` to select `X-Real-IP` for session addresses and auth rate limiting, ignoring `X-Forwarded-For` and overriding `AUTH_CLIENT_IP_HEADER`. Forwarded addresses still require a peer allowed by `TRUSTED_PROXY`; otherwise, or without `X-Real-IP`, the connection address is used.
