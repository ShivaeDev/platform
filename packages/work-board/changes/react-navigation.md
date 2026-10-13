### Changed

- Navigation chrome, search, reading preferences, favorites, recents and reading history run in the React client with the shared native query registry.

### Breaking

- Remove the legacy string-script browser runtime and its HTTP asset routes. Remove these package exports and their modules: `diagnostics/script.ts`, `history/script.ts`, `page/sidebarScript.ts`, `page/searchResultsScript.ts`, `page/swap.ts`, `page/visualViewport.ts`, `page/stateScript.ts`, `page/searchScript.ts`, `page/visualScript.ts`, `page/itemContextScript.ts`, `page/libraryScript.ts`, `page/ageScript.ts`, `page/navigationScript.ts`, `page/readingStateScript.ts`, `page/formReadingScript.ts`, `page/diagrams.ts`, `page/client.ts`, `views/savedScript.ts`. Use the Board React client and native browser client instead.
