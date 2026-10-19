---
"@shivaedev/work-board": patch
---

### Changed

- Documents with sections keep an "On this page" outline beside the text on wide screens. It stays in view while the reader scrolls. Narrow screens show an **On this page** button in the page header that opens the outline.
- The pinned header on item and document pages shrinks to a one-line title while the reader scrolls. The text below does not move when the header shrinks.
- Item criteria render inline Markdown such as code, emphasis and links. Lists of more than three criteria, or criteria with long text, show in the main column after the body instead of in the details panel.
- `PR #123` and `PR 123` in an item's next action link to that pull request when every Fleet pull request is in one repository.
