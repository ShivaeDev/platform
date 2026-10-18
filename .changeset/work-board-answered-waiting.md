---
"@shivaedev/work-board": minor
---

### Added

- An answered Fleet decision that Fleet has not acknowledged yet leaves Needs you for an **Answered, waiting for Fleet** group on Today and moves its task to Queued on Now. Its answer card and Now card say who answered and what, for example "You answered: Request changes. Fleet picks this up on its next pass.", and say "Fleet isn't running. It picks this up when it starts again." while Fleet is unavailable. **Change your answer** supersedes the current answer. The attention projection carries these rows as `answered`, and inbox rows, work items and document requests carry an `answered` summary.

### Fixed

- Response history and the saved-answer messages show the authored option labels instead of "Option 1".
