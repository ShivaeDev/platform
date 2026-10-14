### Changed

- Open requests show an answer card directly below the item header, using the existing response form and retained drafts. The separate respond link opens and focuses that card.
- Managed decisions use the unblocked item's title, render their reason as Markdown, and show the question once. Generated identities stay in Source instead of the item header.
- Decisions can use frontmatter options and a recommended choice.
- Typed document requests include optional `title` and `sourceOpen` fields; `DocumentViewProps` accepts an optional `answer` node below the header.
- `documentHtml` accepts optional answer-card HTML, and `composerHtml` accepts an optional card title.
