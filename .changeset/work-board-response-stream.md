---
"@shivaedev/work-board": minor
---

### Added

- `work-board responses --follow <dir>` streams responses across all questions as tab-separated item, request, response ID and first answer line. It starts with new responses; `--since <ISO timestamp>` includes recorded history from that time.
- `responseFeed(root, since?)` from `server/responses/feed.ts` exposes the same lines as an Effect Stream using the workspace filesystem services.
