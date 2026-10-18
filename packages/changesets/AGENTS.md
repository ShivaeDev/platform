# @shivaedev/changesets

This package makes a workspace release reproducible from explicit changesets. A maintainer should be able to read the plan, apply it, and validate the same release after a squash merge without reconstructing an agent's intermediate commits.

Preserving released history wins over convenience. Explicit bumps and named inputs win over inference. Keep failures in Effect's error channel and keep repository policy in typed Effect hooks. The package owns changeset parsing, dependent release planning, collection and validation; it does not publish to npm or choose an application's pinned constants.

Read [README.md](README.md) for usage, [docs/north-star.md](docs/north-star.md) for boundaries and [docs/roadmap.md](docs/roadmap.md) for planned work. Prove behavior through the CLI story kit in `src/test-support`; plain tests belong only to pure parsers.
