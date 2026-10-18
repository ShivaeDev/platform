### Changed

- Now cards say who holds the work in plain words, such as "Fleet is working on this", "Needs you" or "Assigned to you", and how long it has been in its stage, such as "Executing for 4h". Task cards no longer repeat the word "task".
- Now lanes share the page width and scroll inside their own container when the window is too narrow.
- System shows the same "Needs you" count as Today, by Today's rule, in place of Fleet's own "Waiting on maintainer" count. Inbox count badges and the Today links name that count "need you".
- A Fleet decision shows the Board work it reviewed as the work's title, criteria and description instead of its raw front matter.

### Fixed

- Today says "Fleet unavailable" instead of "? in progress" when the Fleet daemon cannot be reached, and names loading or unavailable counts instead of showing "?".
- Sidebar destinations carry explicit accessible names that include their counts.
