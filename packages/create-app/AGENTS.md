# @shivaedev/create-app

This package removes the manual copying and dependency edits between choosing Platform and running a new app. The ideal is one command that leaves a complete, installed starter with a local environment, ready to prepare PostgreSQL and start development.

Keep the starter in `examples/starter` as the source of truth. Package its application code at pack time with the explicitly published versions that the starter records. Keep maintainer guidance and verification metadata out of a generated app; its README and agent guidance live in this package’s `template` directory. When trade-offs conflict, preserve the user's existing files first, prove the generated app against published packages second, and keep the command small third. Filesystem work, processes and failures stay in native Effect. The command owns scaffolding; the application owns its environment and UI.

Read [the README](README.md) to use the command, [the north star](docs/north-star.md) for its boundaries, and [the roadmap](docs/roadmap.md) for open work. The [root guidance](../../AGENTS.md) owns repository-wide rules.
