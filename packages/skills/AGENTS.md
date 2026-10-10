# @shivaedev/skills

You are changing both ShivaeDev's shared agent skills and the practical way repositories receive them. Agent environments do not reliably load every plugin or follow every installation link, especially in cloud checkouts. The instructions should be ordinary repository files that humans and agents can read directly. A versioned dependency supplies updates; sync makes them reviewable copies; check makes drift visible. Maintaining useful shared instructions and making them easy to distribute are both this package's job.

When goals conflict, lean in this order:

1. **Keep Effect native.** Filesystem work and failures stay in Effect, with the existing filesystem services and typed errors visible.
2. **Keep the instructions directly available.** Ordinary committed files are the core delivery path. Preserve supporting files. A plugin, machine-local setup or compatibility link must not become the only way to reach the content. Prefer simple repository copies and updates to a new distribution framework.
3. **Protect repository ownership.** The manifest marks the names this package owns. Refuse a collision before changing files; convenience never justifies replacing an unowned instruction. Keep local skills beside the shared ones.
4. **Maintain the skills and their updates together.** Shared improvements belong here, including the instructions themselves. Managed copies are sync output, not forks to merge. Make the update visible in review and give drift failures a concrete recovery step.
5. **Keep adoption explicit and claims proven.** Repositories choose skills, commits, hooks and CI permissions. A copy check proves only its checked files and records; it does not prove every host discovers or follows them.

Read [the north star](docs/north-star.md) for the full intent, [the roadmap](docs/roadmap.md) for implementation gaps and maintainer questions, and [the README](README.md) to use the package. The [root guidance](../../AGENTS.md) owns repository-wide rules.
