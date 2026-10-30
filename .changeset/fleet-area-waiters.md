---
"@shivaedev/work-fleet": patch
---

### Fixed

- Give available areas to eligible queued work and PR repairs by Fleet priority, then by time waiting. Preserve repair queue age across restarts so new launches of the same or lower priority cannot repeatedly delay conflict or CI repairs and the PRs waiting for them to merge.
