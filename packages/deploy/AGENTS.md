# @shivaedev/deploy

Apps should describe what is theirs when they deploy: service names, commands, variables and resource limits. This package holds the Railway web and worker conventions they would otherwise copy, so the deployment defaults have one owner.

Keep the pieces small and composable with Railway's native service definitions. Explicit application choices win over defaults, and native Railway options win over a second configuration language. Provider integration belongs in adapters; application topology, credentials and deployment execution belong to the app. When these priorities conflict, preserve explicit overrides first, native composition second and convenience third.

Read the [README](README.md) for usage and the repository [AGENTS.md](../../AGENTS.md) for shared conventions.
