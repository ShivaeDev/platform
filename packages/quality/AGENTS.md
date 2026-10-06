# @shivaedev/quality

You are changing the package that makes a repository's quality policy one gate. Scattered commands, warning-only rules and local suppressions let debt hide. Quality gives the policy typed rules, one repair-oriented report, counted existing debt and permanent exceptions with reasons. A repository can adopt strict checks now, and every deliberate relaxation is visible to review. The long form is in [docs/north-star.md](./docs/north-star.md), implementation status and unresolved policy are in [docs/roadmap.md](./docs/roadmap.md), and usage is in [README.md](./README.md).

## Which way to lean

1. **An uncovered problem stays visible.** Error is the default. A broken config, unreadable policy or empty import graph must not pass quietly. A registry exception needs a reason and must still apply; suppressions must not become an escape hatch.
2. **Adoption must work on existing code.** Separate counted debt from permanent exceptions. Tightening lowers debt without raising it, fixed debt does not break the gate, and explicitly recorded growth belongs in a reviewable diff.
3. **The author keeps the judgement call.** A rule says what is wrong and how to repair it. Do not automatically rename a public symbol or reorder code whose order the author owns. Treat unsafe fixes as changes to review, never as a proof of unchanged behavior.
4. **One policy, native tools.** Reuse the shared inventory, import graph, report and baseline. Keep TypeScript, Biome, Vitest, Standard Schema and Effect visible; extend the gate instead of building a second checker path.
5. **Prove the boundary being claimed.** Use seeded repositories and real commands for CLI, git and consumer behavior. A syntax rule cannot prove a test uses the real engine or that a host's runtime works.

The maintainer owns the choice of presets and the unresolved Effect-boundary and service-parameter policies. A new rule must state its scope, show both accepted and rejected code and give a message an agent can act on.
