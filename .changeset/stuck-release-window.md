---
"@shivaedev/work-fleet": patch
---

### Fixed

- Surface a release window stalled for five minutes as one orchestrator wait naming the release PR, its queue removal or idle state, and the number of held PRs. Clear the wait when the release moves or merges, and include held release PRs in watch merge-queue events.
