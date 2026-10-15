### Added

- Project pages open with the goals query's done, in progress and planned counts and Inbox-aligned open-ask count before answer cards, followed by criteria with progress, linked work and recorded evidence before authored Markdown. Empty work groups, untargeted criteria labels and absent evidence stay quiet. Each work row has one held Fleet stage or authored status chip; missing status and PR stay blank.

### Changed

- Goal and criterion `counts` now always contain `done`, `"in progress"` and `planned`, including zeros. Held Fleet stages override authored status; released stages fall back to authored status. Deferred and unrecorded work count as planned. `goals(snapshot, fleet?)` accepts an optional Fleet projection. Internal Inbox rows retain their `unblocks` targets for goal-specific counts; browser Inbox projections keep their existing shape.

### Fixed

- Goal criteria and linked-work tables include every identified implementing item, including results, decisions, questions and responses. The goals query returns these items alongside its counts, including links to closed projects.
