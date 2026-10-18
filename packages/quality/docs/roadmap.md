# Roadmap

This page owns Quality's shared policy, tooling, CLI and hook implementation status and the policy questions below. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns adoption across packages and hosts, integration and deployment validation; it links here for quality implementation work.

## Built

- [x] Optional typed and runtime-validated config with config-free defaults; built-in and local rules enforced at `error`; local-rule and Standard Schema option APIs; one checked inventory and one report grouped by rule.
- [x] The public config rejects `warn`, `off`, raised thresholds, inventory exclusions and custom test-file patterns. Vitest projects reject suite exclusions. Reasoned Biome declarations cover individual rules on explicit files and named directory exclusions.
- [x] A JSON Lines baseline with counted debt, explicit named-rule recording, lowering and pruning, tracked-move handling and preservation of unrelated lines.
- [x] One reasoned config exception list for Quality and Biome, generated native Biome settings at lint and fix time, legacy migration, optional Quality subjects, stale entries and rules that refuse exceptions.
- [x] File-size and comment rules; inline-suppression, double-cast, deprecation-setting and declared-Biome-override checks.
- [x] A shared Biome preset and bridge whose error findings use the gate's baseline; enforcement of the installed Biome's recommended rules; bounded fix rounds and selected fixes left to the author.
- [x] Static import resolution, rejection of production imports of test code, runtime-cycle checks, same-folder relative imports and direct, transitive and vocabulary fences with validated examples.
- [x] Manifest sorting and identifier, file, folder, content, test-layout and story-setup conventions.
- [x] Shared type-check and package-build TypeScript presets; Vitest unit, DOM and opt-in slow projects, excluded type tests and inherited project tags.
- [x] Opt-in pre-commit hooks with per-worktree config and dependencies, conventional `typecheck` and `quality:commit` scripts, and explicit installation.
- [x] Seeded-repository and real-command tests for the gate, import policies, Biome, baseline and git hooks, plus packed consumer checks for the CLI and presets.
- [x] Separate shipped Biome declarations from consumer exceptions; reject whole-check, group and blanket-scope consumer declarations.
- [x] Shared nesting-depth and index-module checks; Platform's catalog and manifest checks use the local-rule API and the same inventory, report and baseline.

## Next

- [ ] Remove obsolete CLI warning-report controls; config levels are already enforced at `error`. Keep old-debt adoption in the baseline.
- [ ] Reduce policy-tuning inputs to the ones checks need about a repository. Thresholds can only be lowered; local-rule APIs remain exposed. Review the remaining extension boundary.
- [ ] Split Grit implementation modules by the checks they own, without making consumers select competing presets; route Platform's remaining static checks through Quality.
- [ ] Define the Effect-boundary rule's source and test scope before porting the repository's `try`/`async` restrictions.
- [ ] Define the service-parameter policy before enforcing it against public helpers that accept services or `Context`.

## Open questions

The whole-policy direction is settled: Quality selects which checks run, and enabled checks should fail on uncovered findings; repositories adopt its defaults. The questions below concern how to implement that policy and where checks apply.

- **Extension policy.** Which repository-specific local-rule APIs and Biome declarations should remain public? Consumer rule switches, raised limits and exclusions are rejected immediately with a migration fragment.
- **Effect boundaries in tests.** Should tests follow the same Effect-only boundaries as shipped code, use a test-specific adapter scope, or remain exempt? The repository rule and test fixture patterns do not settle this policy.
- **Services as parameters.** Should a rule cover only service implementation methods, allow explicit integration helpers, or require public APIs that accept services or `Context` to change? The maintainer owns those API decisions before a reusable rule can enforce them.
- **Strict boolean expressions.** Should the preset enable Biome's nursery `useStrictBooleanExpressions`? It reports truthiness checks whose falsy cases differ, such as `if (value)` on `string | undefined`, where an empty string reads as missing. It has 63 findings across this repository, mostly in `work-fleet` and `work-board`, and some of them rely on `||` treating `""` as absent on purpose. The open choice is whether to adopt it with the existing findings in the baseline or fix them first, and whether to wait until Biome's reworked type inference behind the rule settles.
- **Module exports.** The `./*.ts` export pattern makes implementation modules accessible alongside config, rules, fences and Vitest helpers. Which of those modules should consumers treat as extension APIs? Documentation lists the current exports; changing their public boundary requires a maintainer decision.
