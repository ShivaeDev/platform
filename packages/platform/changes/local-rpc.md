### Added

- `rpc-server/local.ts` exports `localRpcGuard(effect)` to reject local HTTP RPC requests before the handler runs unless their remote address and Host are loopback, their Origin is absent or matches the HTTP Host, and their content type matches the native RPC serialization. It needs no session provider. The module also exports `loopbackOnly(handler)` and `sameOrigin(request)` for local HTTP routes.
