---
"@shivaedev/identity": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/identity`: Carry the exact trusted-origin allow-list with the session origin policy and admit declared sibling origins through the HTTP RPC transport guard.
- `@shivaedev/server`: Answer RPC and mounted auth CORS preflights and responses with the exact declared sibling Origin and credentials enabled, retaining native bearer behavior and existing session cookie attributes.
