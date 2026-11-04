---
"@shivaedev/github": minor
---

### Breaking

- Import `read`, `write`, `list`, `listPages` and `listBounded` from their own modules, such as `@shivaedev/github/read.ts`, instead of `@shivaedev/github/GitHub.ts`. Import `withInstallation` from `@shivaedev/github/withInstallation.ts` instead of `@shivaedev/github/installationClients.ts`. Service definitions now list named operations with separate initializers; request, authentication and cache behavior stays the same.

- Import check-run schemas from `@shivaedev/github/checkRunSchemas.ts` instead of `@shivaedev/github/checkRuns.ts`, sticky-comment schemas from `@shivaedev/github/stickyCommentSchemas.ts` instead of `@shivaedev/github/stickyComments.ts`, and `GitHubAppCredentials` from `@shivaedev/github/GitHubAppCredentials.ts` instead of `@shivaedev/github/installationClients.ts`.

- Import `GitHubApp` from `@shivaedev/github/app/GitHub.ts` instead of `@shivaedev/github/installationClients.ts`.
