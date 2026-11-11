---
"@shivaedev/quality": patch
---

### Changed

- A lint drops the story program after the last rule that reads it, instead of keeping it until the run ends, and the package walk parses installed declarations into a registry of its own. Measured on Platform's own repository, the heap a run keeps after the walk goes from about 0.8 GB to 0.1 GB, and at the end of the run from 1.5 GB to 0.2 GB. The findings do not change.
