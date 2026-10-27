# @shivaedev/admin

This package turns explicitly authored admin pages into one protected native Effect RPC group. Operators need a single place to find the tools an application exposes; an omitted permission check must never turn an admin page into a public operation.

Keep native contracts, handler Layers and their inferred requirements visible. Apply each page's declared permission middleware to the whole contract, including its generated change subscription. A read-only page declares queries and no commands. Registry composition rejects collisions instead of letting one page replace another.

Browser page declarations and route metadata stay independent of server registration. The application owns its admin shell, custom views, session policy and the existing RPC host. Built-in views live on the client side and use the same contracts; browser-safe declarations must not depend on React or server storage. Prefer that composition over another transport, UI framework or authorization policy. Prove access through native RPC and preserve handler types through registration.

See the [README](README.md) for usage and the [root guidance](../../AGENTS.md) for repository conventions.
