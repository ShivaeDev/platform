### Changed

- Navigation chrome, search, reading preferences, favorites, recents and reading history run in the React client with the shared native query registry.

### Fixed

- Back navigation and reload report a missing saved passage after restoring reading state, without changing the restored scroll or focus.
- Search retains its query across dismissal and reopening, and keyboard dismissal restores the original control's focus and text selection.
- Search passages that share a heading URL remain distinct when refreshed results remove or reorder entries.
- Search keeps a valid keyboard selection when refreshed results shrink, so Enter opens the remaining selected result.
- Editing a search query immediately clears previous options, so Enter before the debounce completes cannot open an old result or command.
- A successful document refresh clears the previous navigation failure without resetting the current reading position or focus.

### Breaking

- Remove the legacy string-script browser runtime and its HTTP asset routes. Remove these package exports and their modules: `diagnostics/script.ts`, `history/script.ts`, `page/sidebarScript.ts`, `page/searchResultsScript.ts`, `page/swap.ts`, `page/visualViewport.ts`, `page/stateScript.ts`, `page/searchScript.ts`, `page/visualScript.ts`, `page/itemContextScript.ts`, `page/libraryScript.ts`, `page/ageScript.ts`, `page/navigationScript.ts`, `page/readingStateScript.ts`, `page/formReadingScript.ts`, `page/diagrams.ts`, `page/client.ts`, `views/savedScript.ts`. Use the Board React client and native browser client instead.
