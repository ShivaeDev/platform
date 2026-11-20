# @shivaedev/server

You are changing the application host: the one Layer that turns an Effect application's contracts, handlers, migrations and session policy into a running Node process. Every application gets the same answers to the questions a server shell must settle, such as when migrations finish, how big a request may be, which proxy to trust, what reaches a log or a trace and how shutdown proceeds, without assembling them by hand.

## Which way to lean

When goals conflict, they win in this order:

1. **Keep Effect's boundaries intact.** Scope, interruption, typed failures and transactions survive every hop through HTTP, RPC and Promise callers. Shared Layers never capture a caller's identity.
2. **Fail closed at the edge.** Bounded bodies, trusted proxies, origin checks and redaction default to the safe choice; widening one takes explicit configuration.
3. **Host, do not own.** Identity, sessions and permissions belong to `@shivaedev/identity`, failure vocabulary and redaction rules to `@shivaedev/errors`, persistence to `@shivaedev/sql`. The host composes them and adds only what a process needs: listeners, migrations, health, telemetry and lifecycle.
4. **Prove the particular composition.** A test of injected HTTP or simulated socket events does not establish a deployed host's behavior. Document only the boundary the test exercises against real HTTP and PostgreSQL.
5. **Remove repeated application code thinly.** Prefer a native Layer or one option over another framework. An extra option needs a real caller's need.

The [README](README.md) teaches consumers. Follow the repository's [AGENTS.md](../../AGENTS.md) for checks and changes to public APIs.
