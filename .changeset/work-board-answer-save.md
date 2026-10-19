---
"@shivaedev/work-board": minor
---

### Added

- `client.responses.answerQuestion` saves an answer in one command: it registers the question for the reviewed revision and records the response together.

### Changed

- Answering from Today closes the popover as soon as the server saves the answer. The row leaves Needs you at once and "Answer saved" appears beside the heading while the Board refreshes in the background. The popover says "Saving your answer…" while it waits.
- The Today popover shows the options or recommendation from the question's body in a collapsed section, and its link reads "Read the full question".
- Today and the item page use the same words: "Your answer", "Answers so far" and "More options".
- The Today popover and the item page's answer card disable their answer controls while the Board's live connection is reconnecting, and say why. A draft on the item page stays in place.
- Screen readers name the popover's answer group after the question's title instead of its IDs.
- The Board's answer forms save through `answerQuestion` instead of calling `registerQuestion` and then `recordResponse`.

### Fixed

- An answer whose browser closes mid-save is still saved in full, so a registered question never lands without its response.
