# @shivaedev/skills

This package gives shared agent instructions one maintained source and lets each repository choose which ones to keep beside its own. The installed package supplies the instructions; the repository commits copies; a check makes a missing, stale or edited copy visible. Agents should be able to read the same reviewed files without each repository maintaining another version of them.

When goals conflict, lean in this order:

1. **Keep Effect native.** Filesystem work and failures stay in Effect, with the existing filesystem services and typed errors visible.
2. **Protect the repository's own instructions.** The manifest is the ownership boundary. Refuse a name collision before changing files; convenience never justifies replacing an unowned folder or link.
3. **Keep one source for a shared skill.** A repository selects and copies a shipped skill; it does not maintain a fork inside the managed copy. Preserve the skill's auxiliary files and give both agent directories access to the same content.
4. **Make drift actionable and prove the promise.** A failure names what differs and how to restore the copies. Do not describe a check as stronger than the tests establish.
5. **Keep adoption explicit and small.** The repository owns its selection, commits, hooks and CI permissions. The package distributes instructions and checks copies; it does not execute an agent's work or install repository policy on its behalf.

Read [the north star](docs/north-star.md) for the trade-offs, [the roadmap](docs/roadmap.md) for work and maintainer questions, and [the README](README.md) to use the package. The [root guidance](../../AGENTS.md) owns repository-wide rules.
