---
"@shivaedev/quality": minor
---

### Added

- Add `makeRuleStory` under `testing/ruleStory.ts` to seed scoped fixture repositories, check custom rules, run the gate and read findings and reports through Quality's real engine. Use its `qualityInstalled` trait for fixtures that need the installed package.
- Publish the lower-level fixture and command helpers under `testing/adapters/` for existing test kits.
