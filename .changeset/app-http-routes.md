---
"@shivaedev/server": minor
"@shivaedev/create-app": minor
---

### Added

- Application HTTP routes registered through `appHost.routes` can use app services, with route construction errors and missing dependencies retained in the host's types. Generated apps register HTTP routes and static assets through this option.
- Application routes can answer foreign-origin preflights through native `HttpMiddleware.cors`. Host origin restrictions cover the configured RPC path and `/api/auth/*`, including `/api/auth`; other foreign origins still receive 403 there.
