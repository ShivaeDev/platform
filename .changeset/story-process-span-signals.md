---
"@shivaedev/test-story": minor
---

### Added

- Wait for child-process output with scoped `lineSignals` and `untilLine`, exported traces with the OTLP receiver's `untilSpan`, and unfinished HTTP connections with `fakeHttpService.untilAbandoned`. Each wait uses `until`, retains earlier observations, and reports the missing signal on failure.
