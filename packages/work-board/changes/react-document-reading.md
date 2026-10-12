### Changed

- Document and item pages render from the typed document query in the React shell, including reading tools, source context and standalone-question answer controls.

### Added

- The document query includes optional `reading` context described by the exported `ReadingContext` schema (source lines, frontmatter, backlinks, criterion claims, evidence source links and managed receipts) and optional request `prompts` and `promptUnavailable`. `DocumentView` accepts optional `context` and `introduction` React nodes for the document layout.

- The navigation query includes optional `home` data with the configured board file and its unique identity, so the shell can select its reader without issuing a document query for a home board.
