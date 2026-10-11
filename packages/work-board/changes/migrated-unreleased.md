### Added

- Add a sidebar and top-bar Inbox with a live count for human-owned open next actions, open questions and Fleet work waiting on a person. Overview links to an Inbox summary; Work cards/tables show Waiting on you without changing recorded status columns. Missing and duplicated IDs remain visible with source links, and ages beyond 48 hours use days. Group Fleet decision sources and their question/response records under a collapsed sidebar section.
- Standalone `kind: question` items accept optional label/description options and a recommended label. Their item pages support option buttons and free-text answers through the opted-in response publisher. An answer removes the question from the Inbox for its exact reviewed source; edits require a new answer and original source bytes stay unchanged. Closed or invalid questions keep readable answer history. Option buttons use equal widths and spacing; the answer form remembers the local author and puts response details behind a toggle.

- Add a Diagnostics view with live native reads of Codex app-server usage windows, one-minute shared GitHub REST/GraphQL limit reads, and optional versioned Fleet health snapshots. Each source reports missing configuration and failures independently; Fleet freshness, concurrency, queues, human blockers and scheduler/capacity observations remain visible.

- Opt-in managed decision requests can be acknowledged by immutable, exact-context `request_receipt` records. Applied receipts require the unique current answer; superseded receipts retire the old request without fabricating a reply. The overview and response surface exclude qualified acknowledged requests while preserving their original source. Authored requests remain source-driven, and receipts grant no execution, acceptance or delivery authority.

### Fixed

- Inbox ages and order follow current file modification times, including content-preserving touches and index restarts, while unchanged document identities stay reused. Place the sidebar Inbox above recent files and Getting started, and space Clear selection above the answer label.

- Preserve Changes-view control state through live page refreshes so a ready Mark seen action stays available and an overlapping observation keeps its busy state.

- Mark stale Fleet snapshots and dim their counts while displaying the publisher’s observation time. Label Codex windows by duration, show local and relative resets, explain unsupported snapshot versions and API-key account limits, and make Diagnostics available in the header.

- Keep same-origin assets and unrecognized routes in browser navigation instead of intercepting them as reader pages. Preserve native returned-result navigation.

### Changed

- Re-read only changed Markdown paths after each settled watcher batch. Retain unchanged parsed documents and search entries, update dependent metadata diagnostics, and coalesce bursts larger than 256 events into one revision. Watcher recovery checks source bytes while retaining unchanged parses.

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Render the file sidebar as nested native folders with shared ancestry, keeping home first, logical reference URLs and folder collapse state through live updates.
