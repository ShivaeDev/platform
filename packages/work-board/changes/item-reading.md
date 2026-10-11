### Changed

- Document markup places the title, authored status and next action before source context and prose. Source context contains provenance, backlinks and reading tools; its disclosure defaults open at the desktop media query and closed at the narrow query. DOM tests cover this order and disclosure state, not browser layout or physical devices.
- The exposed rendering helpers accept optional introduction controls: `documentHtml` takes a fourth introduction HTML argument, `metadataHtml` takes a fourth summary flag, and `documentHeadings` takes a title-first flag. Existing arguments remain valid.
- The exposed `itemIntroduction`, `itemContextScript` and `itemStyles` helpers supply the authored summary, responsive disclosure behavior and document layout styles.
- Reading-state snapshots store context disclosure state separately from the existing detail-state array. Live document patches retain disclosure nodes and their open state; navigation and diagram regressions cover restored reading records and mounted details.
