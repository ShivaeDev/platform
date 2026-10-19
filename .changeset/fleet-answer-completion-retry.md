---
"@shivaedev/work-fleet": patch
---

### Fixed

- When an answer's completion write fails and is retried, the retry leaves an answer that Fleet already recorded and is still resolving in the background to that resolution. Before, a retry in that window published the answer again and could also queue it as a pending answer for the next turn, which left the answer turn stuck in submission.
