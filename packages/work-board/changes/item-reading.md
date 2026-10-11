### Changed

- Document markup places the title, authored status and next action before source context and prose. Source context contains provenance, backlinks and reading tools; its disclosure defaults open at the desktop media query and closed at the narrow query. DOM tests cover this order, disclosure state and a viewport-height CSS placement bound, not measured browser layout or physical devices.
- Item-page controls above the title have scrollable viewport-height caps. Question forms keep the text-column width and start margin; desktop grids allocate excess context height to the prose row. DOM style assertions cover these constraints.
- The exposed rendering helpers accept optional introduction controls: `documentHtml` takes a fourth introduction HTML argument, `metadataHtml` takes a fourth summary flag, and `documentHeadings` takes a title-first flag. Existing arguments remain valid.
- The exposed `itemIntroduction`, `itemContextScript` and `itemStyles` helpers supply the authored summary, responsive disclosure behavior and document layout styles.
- Reading-state snapshots store context disclosure state separately from the existing detail-state array. Live document patches retain disclosure nodes and their open state; navigation and diagram regressions cover restored reading records and mounted details.
