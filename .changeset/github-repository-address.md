---
"@shivaedev/github": minor
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": minor
---

### Added

- `@shivaedev/github`: Export `parseRepositoryAddress` from `repositoryAddress.ts`, returning an Effect `Result` with the address form, repository identity, a pull-request number when present, or a typed `GitHubAddressInvalid` failure.
- `@shivaedev/work-fleet`: Accept shared GitHub repository remote forms for report publication checks, including `ssh://git@github.com/` and `git+https://` remotes.

### Fixed

- `@shivaedev/work-board`: Share GitHub repository address parsing and normalize `.git` suffixes in repository shorthand when linking pull requests.
- `@shivaedev/work-fleet`: Share GitHub address parsing across publication, watching, checks and merging. Ignore unsupported hosts and invalid PR numbers when watching, refuse them before GitHub observation or automatic merging, and keep local Git remotes distinct from GitHub shorthand.
