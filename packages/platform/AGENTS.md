# @shivaedev/platform

You are changing the shared boundaries that an Effect application otherwise writes again: typed errors, request identity, session resolution and tracing, plus the runtime and HTTP cleanup that connect Effect to Promise callers. Applications need one account of who made a request and why it failed, without mixing users, trusting message-supplied credentials or turning an authentication outage into an anonymous user. The optional Better Auth database adapter and Prisma/tRPC test harness compose those integration packages; they do not define the native SQL path.

## Which way to lean

When goals conflict, they win in this order:

1. **Keep Effect's boundaries intact.** Provide identity around the invocation, preserve typed rejections and cancellation, and carry the transaction's services across Promise calls. Shared Layers must never capture a caller's identity.
2. **Trust the transport for authentication.** Origin checks and session providers read the HTTP request or WebSocket upgrade headers. Request ids are caller-controlled correlation data. A missing session, a forbidden origin and a provider outage are different results.
3. **Own only the shared boundary.** Applications own resource authorization, cookie and session policy, provider configuration and transports. Native RPC stays visible; persistence, contracts and generic test execution stay with their packages. Optional integrations must not become dependencies of the core modules.
4. **Prove the particular composition.** A test of injected HTTP or simulated socket events does not establish a deployed host's behavior. Document only the boundary the test exercises, and keep sensitive data out of diagnostics.
5. **Remove repeated application code thinly.** Prefer a small provider function or native Layer over another application framework. An extra option needs a real caller's need.

The full purpose and trade-offs are in [docs/north-star.md](docs/north-star.md); implementation status and maintainer decisions are in [docs/roadmap.md](docs/roadmap.md). The [README](README.md) teaches consumers. Follow the repository's `AGENTS.md` for checks and changes to public APIs.
