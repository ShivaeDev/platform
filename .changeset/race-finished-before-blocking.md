---
"@shivaedev/test-sql": patch
---

### Fixed

- `raceWithLock` fails with the new `FinishedBeforeBlocking` error as soon as a contender has finished while the holder still holds the lock and every other contender has finished too or is blocked, naming the finished contenders' indexes and the blocked count. Before, such a race waited out its whole deadline and failed with `NeverSettled`, and under a controlled clock a contender still opening its connection could be counted as never blocking.
