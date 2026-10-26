# @shivaedev/releases

This package makes a workspace release reproducible from explicit changesets. A maintainer should be able to read the plan, apply it, and validate the same release after a squash merge without reconstructing an agent's intermediate commits.

Preserving released history wins over convenience. Explicit bumps and named inputs win over inference. Keep failures in Effect's error channel and keep repository policy in typed Effect hooks. The package owns changeset parsing, dependent release planning, collection and validation; it does not publish to npm, schedule or approve releases, or choose an application's pinned constants.

Read [README.md](README.md) for usage. Prove behavior through the CLI story kit in `src/test-support`; a pure parser gets a plain test in a `.unit` file, never a story that ignores the kit.
