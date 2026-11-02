---
"@shivaedev/work-fleet": patch
---

### Fixed

- Read changed paths from a pinned base/head comparison when GitHub's PR file count and paginated listing disagree after base merges. Refuse an untrustworthy comparison once with the observed counts instead of exhausting transient-read retries.
