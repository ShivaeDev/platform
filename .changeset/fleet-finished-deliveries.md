---
"@shivaedev/work-fleet": patch
---

### Fixed

- Keep merged work finished after release, record exact reviewed delivery outcomes, and require an explicit dispatch of a changed brief to start new work.
- Stop running work from the CLI with an acknowledged interruption and closing Board response while preserving its branch and PR.
- Exclude the orchestrator's own release and answer responses from `watch --events board-answer`.
