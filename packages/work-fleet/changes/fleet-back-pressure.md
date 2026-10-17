### Added

- `openPullRequests: { ease, max, floor? }` in `fleet.config.json` slows new implementer launches as Fleet-owned open PRs pile up: full `concurrency` up to `ease` open PRs, then linearly fewer down to `floor` (default 0) at `max`. Held items wait with `waiting for open PRs to merge: <open> of <max>`. Reviews, repairs and answers are never throttled, and when slots are short they go ahead of new implementers.
- `work-fleet dispatch --now <id>`, or `fleet-priority: urgent` in a task's frontmatter, launches the item over `concurrency`, the open-PR curve and `backlog` while still respecting area claims and dependencies; `--ignore-areas` also skips area claims. `work-fleet status` marks such launches as `launched over the limit`.
- `fleet-priority: urgent | high | normal` in task frontmatter orders prepared work for admission when slots are short.
