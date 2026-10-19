---
"@shivaedev/work-board": patch
---

### Added

- The goals query returns each goal's open `asks` with a link to each answer card, and each linked item's file `modified` time and `waiting` reason.

### Changed

- A goal page links its open asks in amber: one ask goes straight to its answer card, and several open a short list of links. Zero counts in the progress legend are muted, so amber appears only when something needs you.
- Linked work that is not done and has an open ask counts as Needs you, so the Needs you count and the open asks agree.
- Deferred work counts in the Planned table group, so each table group matches its count in the progress header.
- Criteria render as cards with a one-line count summary, and their linked items sit in a disclosure that starts closed. The Planned and Done tables also start closed, which keeps long goal pages short.
- The In progress table shows each item's owner and when it last changed.
- A goal with no linked work shows an empty state instead of zero progress and an empty Linked work section.
