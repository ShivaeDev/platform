---
"@shivaedev/github": minor
---

### Breaking

- Rename `@shivaedev/effect-github` to `@shivaedev/github`. Change dependency declarations and imports from `@shivaedev/effect-github/...` to `@shivaedev/github/...`; module paths inside the package are unchanged.

### Changed

- Depend on `@shivaedev/http` and `@shivaedev/errors` instead of `@shivaedev/contract` and `@shivaedev/platform`. Artifact downloads read through the shared bounded body reader of `@shivaedev/http` and still fail with `GitHubArtifactTooLarge` over the caller's byte cap.
