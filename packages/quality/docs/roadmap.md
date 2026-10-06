# Roadmap

This page owns quality's rule, preset, CLI and hook implementation status and the policy questions below. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns adoption across packages and hosts, integration and deployment validation; it links here for quality implementation work.

## Built

- [x] A typed and runtime-validated config, built-in and local rules with Standard Schema options, one checked inventory and one report grouped by rule.
- [x] A JSON Lines baseline with counted debt, explicit named-rule recording, lowering and pruning, tracked-move handling and preservation of unrelated lines.
- [x] A registry of reasoned exceptions with optional subjects, detection of stale entries and rules that refuse exceptions.
- [x] File-size and comment rules; inline-suppression, double-cast, deprecation-setting and declared-Biome-override checks.
- [x] A shared Biome preset and bridge whose error findings use the gate's baseline; enforcement of the installed Biome's recommended rules; bounded fix rounds and selected fixes left to the author.
- [x] Static import resolution, runtime-cycle checks, same-folder relative imports and direct, transitive and vocabulary fences with validated examples.
- [x] Manifest sorting and identifier, file, folder, content, test-layout and story-setup conventions.
- [x] Shared type-check and package-build TypeScript presets; Vitest unit, DOM and opt-in slow projects, excluded type tests and inherited project tags.
- [x] Opt-in pre-commit hooks with per-worktree config and dependencies, configured commands, staged debt tightening and protection for partly staged files.
- [x] Seeded-repository and real-command tests for the gate, import policies, Biome, baseline and git hooks, plus packed consumer checks for the CLI and presets.

## Next

- [ ] Port the reusable rules still in `script/lint/rules/` into quality with options, so repositories can use them without copying Platform's scripts.
- [ ] Split the shared Grit plugins and introduce presets with clear scopes, then route Platform's remaining static checks through the package.
- [ ] Define the Effect-boundary rule's source and test scope before porting the repository's `try`/`async` restrictions.
- [ ] Define the service-parameter policy before enforcing it against public helpers that accept services or `Context`.

## Open questions

- **Effect boundaries in tests.** Should tests follow the same Effect-only boundaries as shipped code, use a test-specific adapter scope, or remain exempt? The repository rule and test fixture patterns do not settle this policy.
- **Services as parameters.** Should a rule cover only service implementation methods, allow explicit integration helpers, or require public APIs that accept services or `Context` to change? The maintainer owns those API decisions before a reusable rule can enforce them.
- **Reusable gate and presets.** Which naming and Effect conventions are always part of quality, and which should be opt-in presets? The next plugin split needs that boundary stated explicitly.
- **Module exports.** The `./*.ts` export pattern makes implementation modules accessible alongside config, rules, fences and Vitest helpers. Which of those modules should consumers treat as extension APIs? Documentation lists the current exports; changing their public boundary requires a maintainer decision.
