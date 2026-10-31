---
"@shivaedev/quality": minor
---

### Fixed

- Check story kits in all packages except test-story, test and types, including test-story's development dependencies. Apply story syntax rules to kit declarations in both `.test` and `.spec` files; keep unit and typecheck tests outside those rules.

### Breaking

- Remove `isSpec` from `@shivaedev/quality/rules/stories/syntax.ts`. Consumers selecting story files must use `storySources` from `@shivaedev/quality/rules/stories/sources.ts` and run its Effect with the rule inputs; story kit origins determine coverage instead of a `.spec` suffix.
