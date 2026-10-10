# Roadmap

This page owns Quality's shared policy, tooling, CLI and hook implementation status and the policy questions below. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns adoption across packages and hosts, integration and deployment validation; it links here for quality implementation work.

## Built

- [x] A typed and runtime-validated config; built-in rules enabled at `error` by default; local-rule and Standard Schema option APIs; one checked inventory and one report grouped by rule.
- [x] Consumer `warn` and `off` settings and reasoned consumer Biome weakenings are implemented and tested. These capabilities do not match the intended whole-policy adoption model; the work below closes that gap.
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

- [ ] Align the public config and CLI with the opinionated policy: remove consumer `warn` and `off` settings and warning-report controls, and prove that the config rejects them. Keep old-debt adoption in the baseline, and remove CLI repair guidance that recommends turning a rule off.
- [ ] Separate Quality's internally reasoned Biome exceptions from consumer weakenings. The current declaration API permits a repository to demote or disable Biome checks; make the whole-policy boundary explicit in validation and tests.
- [ ] Reduce policy-tuning inputs to the ones checks need about a repository. Numeric thresholds and local-rule APIs are exposed; review their public boundary and migration before removing or narrowing them.
- [ ] Port reusable checks still in `script/lint/rules/` into the shared policy, so consumers do not copy Platform's scripts.
- [ ] Split Grit implementation modules by the checks they own, without making consumers select competing presets; route Platform's remaining static checks through Quality.
- [ ] Define the Effect-boundary rule's source and test scope before porting the repository's `try`/`async` restrictions.
- [ ] Define the service-parameter policy before enforcing it against public helpers that accept services or `Context`.

## Open questions

The whole-policy direction is settled: Quality selects which checks run, and enabled checks should fail on uncovered findings; repositories adopt its defaults. The questions below concern how to implement that policy and where checks apply.

- **Configuration migration.** How should an approved API change handle existing consumer levels, numeric thresholds, local rules and Biome declarations: reject policy switches immediately or provide a bounded migration? The README describes their accepted behavior without recommending them. Tests prove these inputs work, while the intended policy excludes consumer rule switches.
- **Effect boundaries in tests.** Should tests follow the same Effect-only boundaries as shipped code, use a test-specific adapter scope, or remain exempt? The repository rule and test fixture patterns do not settle this policy.
- **Services as parameters.** Should a rule cover only service implementation methods, allow explicit integration helpers, or require public APIs that accept services or `Context` to change? The maintainer owns those API decisions before a reusable rule can enforce them.
- **Module exports.** The `./*.ts` export pattern makes implementation modules accessible alongside config, rules, fences and Vitest helpers. Which of those modules should consumers treat as extension APIs? Documentation lists the current exports; changing their public boundary requires a maintainer decision.
