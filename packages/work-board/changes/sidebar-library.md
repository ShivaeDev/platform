### Changed

- Replace the sidebar file tree with counted destinations, pinned documents, active goal status bars and five recent documents. Browse document titles, kind/status filters, lazy folders and modification order in Library; generated Fleet records stay hidden until requested.

### Breaking

- The navigation query returns destination counts instead of `tree` and `records`; `NavigationFile` and `NavigationFolder` schemas are removed. The `Navigation` import at `browser/navigation/schema.ts` remains available. The Library query provides filtered documents and immediate folder children on demand.
