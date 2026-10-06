# @shivaedev/effect-contract

You are changing the package that lets a feature declare its queries, commands, expected failures and refresh dependencies once. Repeating those declarations in handlers, clients and cache wiring makes them disagree. This package turns them into native Effect RPC definitions and binds them to native AtomRpc. Its optional live stream asks those same queries to read again; the query remains the source of the value.

## Which way to lean

When goals conflict, they win in this order:

1. **Keep Effect native.** Return ordinary values and typed failures. Keep Rpc, RpcGroup, middleware, Streams, AtomRpc and Reactivity visible, with their resource and interruption ownership intact.
2. **Declare each boundary once.** Infer payloads, successes, rejections and dependency keys from the feature's schemas. A helper earns its place by removing repeated work in a real consumer, not by offering another way to do the same job.
3. **Refresh the right reads.** A successful command invalidates its affected items and lists. Reconciliation uses the caller's explicit read scope. Neither a connection status nor a change hint is authoritative data.
4. **Keep the client independent of React and servers.** Browser-safe declarations, bindings and resume signals belong here; rendering, sessions, authorization and transaction policy belong with their owners.
5. **Prove the boundary you claim.** Compiler checks prove types; native-client tests prove composition; real HTTP tests prove that transport. None proves an application's deployment, mobile lifecycle or delivery policy.

Do not introduce a second cache, an event journal or a mandatory subscription path. Ordinary queries and commands must remain useful on their own. The full north star is in [docs/north-star.md](docs/north-star.md), package work and open questions are in [docs/roadmap.md](docs/roadmap.md), and usage is in [README.md](README.md). Follow the [root guidance](../../AGENTS.md) for the neighbouring packages' jobs.
