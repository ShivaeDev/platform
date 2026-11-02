---
"@shivaedev/mcp": minor
---

### Breaking

- The Better Auth MCP policy refuses requests with a nonempty Cookie header, even alongside a valid bearer token. Configure MCP clients to omit cookies and send only the access token; browser sessions continue to use the host's cookie RPC.
