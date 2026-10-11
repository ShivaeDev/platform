### Added

- Export `InternalServerError` and `ServiceUnavailable` Schema errors from `errors/taxonomy.ts` for RPC contracts without authentication middleware.
- Export `rpcBoundary(schema, { unexpected, message? })` and `RpcBoundaryOptions` from `rpc-server/boundary.ts`. Declared rejections keep their identity; unexpected failures and defects become one declared rejection with a redacted public message and the original server-only cause. Success and interruption remain intact.
