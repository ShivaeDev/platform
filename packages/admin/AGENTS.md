# @shivaedev/admin

This package turns explicitly authored admin pages into one protected native Effect RPC group. Operators need a single place to find the tools an application exposes, and an omitted permission check must never turn an admin page into a public operation.

The ideal is a thin layer over native pieces: each page is a `@shivaedev/contract` contract with one permission middleware applied to every operation, including its generated change subscription, and registration keeps handler Layers and their inferred errors and requirements visible. The application owns its admin shell, custom views, session policy and RPC host; this package supplies page declarations, the registry, server registration and the built-in Jobs and Users pages that use the same contracts.

When goals conflict, a closed boundary comes first: every operation requires its page's permission, a read-only page declares queries and no commands, and registry composition rejects colliding ids, paths and RPC tags instead of letting one page replace another. Native contracts, Layers and inferred types come next, ahead of convenience wrappers. Then keep browser-safe declarations and route metadata independent of React, server storage and registration. Prefer composing with the application's existing host, UI and authorization over adding a transport, a UI framework or a policy of its own.

Read the [README](README.md) for the usage guide and the repository [AGENTS.md](../../AGENTS.md) for how the packages fit together.
