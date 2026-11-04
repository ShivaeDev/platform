# @shivaedev/discord

Applications should share one Discord transport instead of owning bot REST pacing and gateway session recovery. This package owns those protocol responsibilities; channel choices, message rendering, authorization policy and MCP tool definitions belong to applications.

Preserve native Effect scopes, interruption, typed failures and clocks first, Discord's rate limits and session semantics next, then a small public surface. Keep HTTP on `@shivaedev/http` and sockets behind the native transport port. REST-only consumers should not start a gateway.

The story kit drives the real clients against the stateful Discord provider in test-kits; runtime code ships no fake. See [README.md](./README.md) for the consumer contract and the repository [AGENTS.md](../../AGENTS.md) for shared engineering rules.
