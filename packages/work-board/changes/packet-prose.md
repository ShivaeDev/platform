### Fixed

- Registered question packets show the captured document's prose without rendering its front matter as a heading in the React shell, server fallback or native document view. Stored context and reviewed revisions retain the original bytes.

### Added

- `documentBody(document)` reads display prose from the existing registered-question format or the ordinary parsed document body.
