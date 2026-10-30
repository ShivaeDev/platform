# Changelog

## 0.7.2 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.7.1 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.7.0 - 2026-10-27

### Added

- Check-run creation and updates accept `detailsUrl`, and returned check runs decode the report link from `details_url`.
- List pages expose `hasNext`; `listBounded` returns decoded items and a `truncated` flag without fetching beyond its page cap.
- Call verifyWebhook without a Schema to verify a signature without decoding the body.

## 0.6.0 - 2026-10-27

### Changed

- Depend on `@shivaedev/http` and `@shivaedev/errors` instead of `@shivaedev/contract` and `@shivaedev/platform`. Artifact downloads read through the shared bounded body reader of `@shivaedev/http` and still fail with `GitHubArtifactTooLarge` over the caller's byte cap.

### Breaking

- Rename `@shivaedev/effect-github` to `@shivaedev/github`. Change dependency declarations and imports from `@shivaedev/effect-github/...` to `@shivaedev/github/...`; module paths inside the package are unchanged.

## 0.5.1 - 2026-10-26

### Changed

- Release with updated workspace dependencies.

## 0.5.0 - 2026-10-26

### Added

- Provide the shared expected failure schemas and `rejectedField` in `@shivaedev/effect-contract/errors/`, so browser-safe contract consumers can use them without depending on Platform. Tags, schema fields and RPC encoding remain the same.
- Authenticate App-level requests, including Schema-decoded `GET /app` and paginated `GET /app/installations`, with `githubApp({ appId, privateKey })`.
- Downscope installation tokens with `scope.repositoryIds`, `scope.repositories` and `scope.permissions`, including metadata-only access checks; omit the scope for full installation access.
- Refresh a cached installation token after a resource 401 and retry once, sharing replacement exchanges across concurrent requests and preserving a typed failure on a second 401.
- Download workflow-artifact ZIP archives with `GitHub.downloadArtifactArchive({ owner, repo, artifactId, byteLimit })`. The client reads GitHub's redirect explicitly, requests storage without GitHub credentials, and enforces the caller's byte cap while streaming. Missing or expired artifacts fail with `GitHubArtifactError`; oversized archives stop with `GitHubArtifactTooLarge`. This replaces application-owned redirect handling and archive byte limits.
- Match sticky comments with `appId` to require the marker at the start of the body, the matching `performed_via_github_app.id` and a bot author. Existing marker-inclusion and optional `author` login matching remain available.
- Classify GitHub's integration permission refusal as `GitHubPermissionDenied` and locked conversations as `GitHubConversationLocked`, each with the request path. Other 403s remain HTTP errors; primary and secondary rate limits retain precedence.
- Configure JSON response caps with `GitHubConfig.responseByteLimit` or a trailing byte-limit argument on `read`, `list` and `write`, including their representation methods. The default remains 1 MiB; larger comparisons and listings can allow 16 MiB while retaining streaming size enforcement, typed `ResponseBodyTooLarge` failures and Schema decoding.

### Fixed

- Refresh a rejected GitHub App installation token when downloading a workflow artifact archive and retry once, returning a typed failure on a second 401.

### Breaking

- Move all imports from `@shivaedev/platform/errors/taxonomy.ts` to `@shivaedev/effect-contract/errors/taxonomy.ts`, and from `@shivaedev/platform/errors/rejectedField.ts` to `@shivaedev/effect-contract/errors/rejectedField.ts`. The old modules are removed. Add a direct `@shivaedev/effect-contract` dependency if the consuming package does not already declare one. Admin, GitHub, Work Board and Work Fleet public failure types now refer to these shared classes.
- Generated apps use the new imports. The create-app updater applies the starter changes through its usual three-way patch; it does not rewrite imports in app-owned files. Replace both old import paths above in those files when upgrading existing apps.
- Permission and locked-conversation 403s now fail with the GitHub-specific errors instead of `RemoteHttpError`. Move handlers for those cases to `Effect.catchTag("GitHubPermissionDenied", ...)` and `Effect.catchTag("GitHubConversationLocked", ...)`; keep `RemoteHttpError` handling for other HTTP refusals.

## 0.4.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.0 - 2026-10-25

### Added

- Render untrusted text as literal Markdown text, code spans and table cells, and build row reports within a UTF-8 byte budget with a count of omitted rows.

## 0.3.0 - 2026-10-25

### Added

- Upsert sticky pull-request comments by hidden marker across comment pages, optionally matching an author login.
- Create check runs for a head SHA and move them through in progress to completed with a conclusion and output through Schema-typed requests and responses.

## 0.2.0 - 2026-10-25

### Added

- Authenticate GitHub REST requests as an App installation with built-in RS256 signing, repository installation lookup, and cached installation tokens shared across concurrent requests until their refresh point.
- Verify webhook signatures against raw bytes with HMAC SHA-256 and a constant-time comparison before decoding the delivery with the caller's Schema. Signature and App authentication failures stay typed and exclude credentials from errors and telemetry.
- GitHub paged reads accept a caller policy before each request and expose the observed resource for a path.

### Breaking

- `GitHubToken` may now contain a lazy Effect as well as a static Option. Consumers reading the service directly must resolve it with `Effect.isEffect(value) ? yield* value : value` before inspecting the Option. Existing `Layer.succeed(GitHubToken)` providers and `GitHubToken.fromEnv` need no changes.

## 0.1.0 - 2026-10-25

### Added

- Share token-authenticated GitHub REST reads and JSON writes through an Effect service, with Schema decoding, lazy Link pagination, bounded bodies, ETag revalidation and per-resource rate-limit observations and UTC retry instants.
