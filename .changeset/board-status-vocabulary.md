---
"@shivaedev/work-board": patch
---

### Fixed

- Tasks whose files say `status: review` appear in Now's Reviewing lane, count as in progress on Today and in the Now count, and land in the same group on their goal page. One status vocabulary now drives Now, Today, the navigation count and goal pages.
- Fleet-approved tasks with `status: ready` appear in Now's Queued lane while Fleet is unavailable, and `approved` work counts as planned on goal pages instead of in progress.
- A task, or an item that implements a goal, whose status the Board does not know is listed on System as a file problem instead of being dropped from Now or counted as in progress on its goal page.
- The sidebar's Now count reads **1 open task** in the singular.

### Changed

- Now cards call held work **In progress** instead of naming its stage, and Today's In progress rows from Fleet say **Fleet** without the stage; Now's lane titles still name the stage. Today's In progress also lists Fleet work that is validating or delivering.
