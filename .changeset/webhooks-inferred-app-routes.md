---
"@shivaedev/create-app": patch
"@shivaedev/webhooks": patch
---

### Fixed

- `@shivaedev/webhooks`: Infer webhook route service requirements from registered sources in installed applications, so composing a route into the app host does not add an unknown service requirement.
- `@shivaedev/create-app`: Resolve application aliases through package imports so generated apps do not redirect a dependency’s private imports into application files.
