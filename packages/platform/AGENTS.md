# @shivaedev/platform

You are changing the entry point an application installs to get the whole framework. Platform holds no code: its manifest depends on every runtime piece at the versions released together, and its README maps each job to the package that owns it. An application lists this one dependency and imports each piece by its own name.

## Which way to lean

1. **No code here, ever.** A module that seems to belong in platform belongs in a piece; when two pieces need it, it becomes its own package.
2. **Only applications depend on platform.** Libraries, including published tools such as work-board and work-fleet, declare the pieces they import directly.
3. **The pieces move together.** Platform's dependency list is the set of runtime packages that are released and tested as one framework; test pieces and tooling stay out of it.

The [README](README.md) is the map for consumers. Follow the repository's [AGENTS.md](../../AGENTS.md) for checks and releases.
