### Fixed

- Keep Home, Inbox, Overview, Work, Changes and Diagnostics in fixed sidebar rows. Project files scroll independently and reveal the selected document; recent documents and favorites open in a bounded reading-history dialog. Below 768px, Files opens an overlay drawer with keyboard focus containment, Escape/backdrop dismissal and focus return. The new `page/sidebarScript.ts` module exports `sidebarScript()` to emit the drawer and selected-file scrolling client script.
