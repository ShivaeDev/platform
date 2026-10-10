# @shivaedev/quality

You are changing the package that lets a repository adopt a sensible quality policy without designing one. Choosing rules, debating warning levels and maintaining copied tool configs is work repositories should not have to repeat. Quality owns those choices and supplies one opinionated gate, shared tooling and guidance an agent can act on. A consuming repository adopts the whole policy; it describes its files and architecture, not which standards it wants to follow.

Read the [north star](./docs/north-star.md) for the full intent, the [README](./README.md) for use, and the [roadmap](./docs/roadmap.md) for implementation gaps and the decisions still owned by the maintainer.

## Which way to lean

1. **Own the policy here; keep adoption simple.** Quality decides which checks run and their sensible defaults. An enabled check requires a repair for uncovered findings. Do not introduce consumer warning levels, rule switches or competing opt-in policies. Internal rule and fix exceptions need a reason. Prefer a better shared default to another repository knob.
2. **An uncovered problem stays visible.** The baseline records existing debt while checks remain strict; a permitted permanent exception needs a reason and must still apply. Use these records for adoption, rather than downgrading or disabling a check. A broken config, unreadable policy or empty import graph must not pass quietly.
3. **Leave the author's judgement intact.** A finding explains the repair. Do not automatically rename a public symbol or reorder code whose order the author owns. Unsafe fixes need review; a successful fix command does not prove unchanged behavior.
4. **Keep one gate and native tools.** Rules reuse the inventory, import graph, report and debt handling. Biome, TypeScript, Vitest, Standard Schema and Effect stay visible at their boundaries instead of gaining parallel implementations.
5. **Prove the boundary being claimed.** Use seeded repositories and real commands for CLI, git and tool behavior. A syntax check or example does not prove an application's runtime behavior.

Repository facts can require inputs: source locations, generated files, import boundaries and commands to run at commit time. They do not give each repository ownership of Quality's standards. The maintainer owns unresolved Effect-boundary and service-parameter policies. Define a new rule's scope, accepted and rejected cases and repair message before enforcing it.
