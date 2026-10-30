---
"@shivaedev/quality": minor
"@shivaedev/skills": minor
"@shivaedev/create-app": minor
---

### Breaking

- Specs get new findings from three story rules. `tests/domain-outcomes` reports Effect `Exit`, `Cause` and `Result` uses, `_tag` reads and `"Success"` or `"Failure"` tagged literals: return the outcome in the domain's words from a kit verb or readout. `tests/grouped-outcomes` reports consecutive `expect(yield* …)` checks: write them as rows of one `outcomes` call from `@shivaedev/test-story/server/outcomes.ts`. `tests/wait-on-events` reports sleeps, timers, `eventually`, Vitest fake timers and `TestClock` adjustments: settle on the engine's own signal, and advance the clock in a kit verb named for the time that passes. Record existing findings with `quality baseline write --rule tests/domain-outcomes --rule tests/grouped-outcomes --rule tests/wait-on-events`.

### Changed

- The `story-testing` skill covers how a story reads: one name per actor, actions that name their change, a proven before state, domain outcomes, a separated action, a true title, `outcomes` for several checks, explained setup, one behaviour per story, stories only for plausible regressions, and settling on events. It now applies to package stories as well as app stories.
- Generated apps record the starter's existing findings for the new story rules in their baseline.
