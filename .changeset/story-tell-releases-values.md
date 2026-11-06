---
"@shivaedev/test-story": minor
---

### Fixed

- Capture call-site stack text immediately so told story lines do not retain released values through V8 stack frames. Failing stories still report the spec's file and line.

### Breaking

- Call-site metadata is now `string | undefined` instead of `Error`: `callSite()`, `TraitPart.site`, `Narration.at`, `Narration.sites` and `Narration.tellAt` use stack text directly. Consumers of these low-level exports must replace `.stack` reads with the stored value and pass stack text instead of an `Error` to `tellAt`. Story kits using `story.tell`, `kit.trait` and `story.runUntil` need no changes.
