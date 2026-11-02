---
"@shivaedev/mcp": minor
---

### Breaking

- The MCP OAuth session policy refuses requests carrying a Cookie header, including those with a valid bearer token. Send MCP bearer credentials without cookies; keep browser cookies on cookie-authenticated RPC routes.
