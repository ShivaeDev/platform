---
"@shivaedev/test-story": minor
---

### Breaking

- Kits declaring `outbound` and direct `routeOutbound(routes)` scopes now refuse unrouted external Node fetch requests and fail at scope close, even when application code catches the fetch error. Add hostnames to the outbound map, or explicitly opt into network access with `outboundPassthrough: true` on the kit or `{ passthrough: true }` as the second argument to `routeOutbound`. Loopback requests remain allowed; the DOM environment still refuses unrouted external hosts.
- Thrown fake HTTP handlers now close the connection and fail the story at scope close with the request and a description of the thrown value. To simulate an upstream error, return an error status or script an HTTP fault instead of throwing.
