### Changed

- Open requests show an answer card directly below the item header, using the existing response form and retained drafts. The separate respond link opens and focuses that card.
- Managed decisions use the unblocked item's title, render their reason as Markdown, and show the complete question once, including unfenced multi-paragraph reasons. Page and card headings name the unblocked item. Generated identities stay in Source instead of the item header.
- Decisions can use frontmatter options and a recommended choice. Answer cards lead with the recommendation and relevant PR actions, and directive choices use human labels. Decision and question headers show request state and omit missing fields. Response validation waits for an attempt, with the last saved local author label prefilled.
- Typed document requests include optional `title` and `sourceOpen` fields; `DocumentViewProps` accepts an optional `answer` node below the header.
- `documentHtml` accepts optional answer-card HTML, and `composerHtml` accepts an optional card title.
