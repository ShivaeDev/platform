---
"@shivaedev/contract": minor
"@shivaedev/server": minor
"@shivaedev/react": minor
---

### Breaking

- Contract clients use Effect RPC over a shared WebSocket by default. Replace `httpClient`, `transformClient` and `serialization` client options with a native `protocol` Layer for custom transports. Node clients can supply upgrade `headers` and a `webSocketConstructor` Layer; browsers use their session cookie automatically.
- Mounting a bound query subscribes before its first authorized read; unmounting releases its subscription. Use `live: false` when binding an ordinary client without subscriptions. Query preparation alone no longer opens a change stream.
- Hosts serve live subscriptions on the WebSocket upgrade at the RPC path. Move HTTP `$changes` consumers to Effect RPC's socket protocol; the POST route serves ordinary RPC only. Configure development proxies to forward WebSocket upgrades.

- React session boundaries also ask the auth owner to recheck when the live socket closes. Keep `recheck` safe to call after a network interruption; the auth owner still decides whether the session ends.
