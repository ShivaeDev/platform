---
"@shivaedev/quality": patch
---

### Changed

- A lint no longer keeps type-checker data alive after the rules that need it. The package walk drops the installed declarations it parsed when it ends, and the rules that read the story program run together and drop it after the last of them. On Platform the heap that a run retains after the walk goes from about 0.8 GB to 0.1 GB, and at the end of the run from 1.5 GB to 0.2 GB. The findings do not change.
