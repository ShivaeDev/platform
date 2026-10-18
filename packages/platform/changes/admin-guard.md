### Added

- Export `requireAdmin` from `rpc/require-admin.ts` to guard request-local users with typed `Unauthorized` and `Forbidden` failures. Session users carry the provider's optional role, and `withSessionUser` from `rpc-server/session.ts` shares the identity boundary between HTTP routes and RPC middleware.
