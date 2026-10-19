---
"@shivaedev/work-board": patch
---

### Changed

- While the server reads the workspace, the loading page says how far it has got, such as "Reading 1,240 of 3,936 files…", and "Reading the workspace…" before the count is known.
- Pages start their reads as soon as the Board is live instead of waiting for the sidebar's navigation read.
- The header names its state in plain words, such as "Connecting…", "Updating…" and "Can't reach the Board server", and the Needs you badge shows a spinner while its count is still loading.
- The header no longer repeats a failure that the page already explains, and says "Couldn't refresh this page" when it keeps showing an older copy.

### Fixed

- Server startup lists the workspace concurrently, which cuts listing a workspace of about 4,000 files from several seconds to under half a second.
