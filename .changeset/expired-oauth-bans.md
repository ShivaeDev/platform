---
"@shivaedev/identity": patch
"@shivaedev/mcp": patch
---

### Fixed

- `@shivaedev/identity`: Resolve OAuth grant subjects whose temporary ban has expired by Effect Clock. Active bans and bans without an expiry continue to refuse access.
- `@shivaedev/mcp`: Admit a member's MCP client once their temporary ban expires, including before they sign in on the web again.
