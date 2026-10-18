# @shivaedev/create-app

This package removes the manual copying and dependency edits between choosing Platform and running a new app. The ideal is one command that leaves a complete, installed starter with a local environment, ready to prepare PostgreSQL and start development.

Keep the starter in `examples/starter` as the source of truth. Package it at pack time with the explicitly published versions that the starter records. When trade-offs conflict, preserve the user's existing files first, prove the generated app against published packages second, and keep the command small third. Filesystem work, processes and failures stay in native Effect. Generated files are pack-time artifacts, never a second checked-in template. Keep the interface to the folder argument and ordinary CLI flags. The command owns scaffolding; the application owns its environment, UI, production configuration and deployment.

Read [the README](README.md) to use the command. The [root guidance](../../AGENTS.md) owns repository-wide rules.
