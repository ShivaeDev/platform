---
"@shivaedev/github": minor
---

### Breaking

- Import `GitHub` from `@shivaedev/github/github/service.ts` and `GitHubApp` from `@shivaedev/github/app/service.ts`. Provide `GitHub.layer` or `githubApp(credentials)` once; the App Layer supplies its installation-client provider. Direct `GitHubApp.layer` composition now requires `GitHubClients`. Import `ArtifactArchiveOptions` and `RepositoryListOptions` from their same-named modules.
- Replace dependency-capturing factories (`representations`, `repositoryReads`, `checkRuns`, `stickyComments`, `artifacts`, `initializeArtifacts`, `viewerRepositoryAccess` and `graphqlRequests`) and imports from `operations/` with the yielded `GitHub` or `GitHubApp` service's operations or the Schema-aware `read`, `write`, `list`, `listPages` and `graphql` helpers. Request and pagination helpers now take owned cache state instead of clients and config. Token layer construction lives at `adapters/appTokens.ts`.

### Changed

- GitHub operations yield configuration, credentials and transport from their declared environment. Initializers retain only owned caches and rate-limit state; deferred pagination and token exchanges retain the bound environment through adapters.
