# @shivaedev/identity

This package answers "who is calling, and may they?" for every Effect RPC request. Shared contracts declare the requirement with middleware tags, the server resolves a session through a provider and an Origin policy, permission middleware checks the grants the session carries, and handlers read a typed `Identity`. Better Auth is the supported provider and lives here behind `server/better-auth/`.

The ideal is that a missing check cannot compile: a handler that reads `Identity` only builds when its contract declares the middleware, and an undeclared refusal never reaches the client. When goals conflict, refusing an unauthenticated or untrusted request comes first, then keeping the shared declarations browser-safe and the core free of optional peers, then the provider's own behaviour over a wrapper of ours, then convenience. The application host, its routes and its database belong to the server package; role management screens belong to admin.

Read the [README](README.md) for the usage guide, [docs/framework/request-context.md](../../docs/framework/request-context.md) for how identity flows through a request, and the repository [AGENTS.md](../../AGENTS.md) for how the packages fit together.
