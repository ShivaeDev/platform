# @shivaedev/http

This package holds the small pieces every Effect application writes around Effect's own HTTP client and server: reading a body without trusting its size, turning a status into a typed failure, and following paginated links. Integrations such as GitHub and the platform server build on it, so a limit or a status rule is decided once.

The ideal is a thin layer over `effect/http` that keeps the native client, request and response visible and only adds what removes repeated application code. When goals conflict, bounded resource use comes first, then failures that are typed and carry no headers or bodies, then convenience. Anything that knows about a specific remote API belongs in that integration's package, not here; anything that knows about RPC, sessions or the application host belongs in the server.

Read the [README](README.md) for the usage guide and the repository [AGENTS.md](../../AGENTS.md) for how the packages fit together.
