# @shivaedev/supervisor

Applications own local processes for as long as they own their scopes. This package removes repeated spawn, readiness, restart and shutdown code from shells and hosts while letting the application express startup order and dependency policy.

Prefer native Effect scopes, typed failures and interruption over convenience. Each attempt has its own scope; replacement must release the old attempt before acquiring another. Keep process libraries in adapters, and keep application-specific commands, readiness data and dependency graphs in the application. Backoff and output capture serve owned local children, not remote orchestration.

Keep the public surface small and prove lifecycle behavior with real children through the story kit. Read the [README](README.md) for usage and the repository [AGENTS.md](../../AGENTS.md) for development conventions.
