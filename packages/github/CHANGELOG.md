# Changelog

## 0.10.0 - 2026-11-02

### Added

- Add typed, byte-capped issue, user, collaborator-permission, commit, comparison and tree reads, plus paged issue, pull-request-file and commit lists on the GitHub service.
- Let Schema-aware lists select arrays inside envelopes, pace each request and opt into skipping undecodable items. `listPages` reports decoded items and skipped counts for each page; `listBounded` includes the total `skipped` count alongside `items` and `truncated`. Existing numeric byte-limit arguments remain supported, and decoding still fails by default.
- `GitHubApp.viewerRepositories(account)` accepts a GitHub account ID or login and returns readable and administrable installed repositories, with access results cached for 60 seconds across at most 100 accounts.

### Fixed

- Keep shared App clients independent of a single-installation Layer's repository and permission scope.

### Breaking

- `downloadArtifactArchive` now returns an array of `{ path, bytes }` files instead of raw ZIP bytes. Install the optional `@zip.js/zip.js` peer and consume these validated files instead of passing the result to an application ZIP reader. Extraction refuses unsafe paths, symlinks, duplicate paths and file/directory conflicts, with distinct typed errors. The default caps are 100 MiB of extracted contents and a per-entry compression ratio of 100:1; set `totalSizeLimit` and `compressionRatioLimit` to change them. The existing `byteLimit` still caps the downloaded ZIP.
- The low-level `artifacts` constructor now takes `(apiUrl, rates)` and returns an Effect. Yield it with `HttpClient`, `GitHubToken` and `TokenRefresh` provided instead of passing those services as arguments.

## 0.9.0 - 2026-11-02

### Added

- Send PUT and DELETE through the shared authenticated mutation path, omit absent request bodies, and decode bodyless 204 results as `void` by omitting the response schema or using `Schema.Void`.
- Find the latest commit check run by name, app ID, or both with `findLatestCheckRun`, and create or update it with `upsertCheckRun`. Check-run responses expose the app ID when present and recognize GitHub Actions-only read statuses.
- One `githubApp` Layer now provides `GitHubApp` and `withInstallation` to share clients across installations, with separate token refresh, conditional caches and rate-limit state. The cache holds at most 100 clients, evicts the least recently used client when full and replaces clients after 30 minutes idle.

### Fixed

- Installation lookups and token exchanges use the same rate-limit detection and retry deadlines as App and resource requests. Quota exhaustion returns typed `GitHubRateLimited`, and requests fail locally until its deadline instead of repeating authentication requests.
- Read HEAD responses and statuses 204, 205 and 304 as empty bytes or text; JSON decoding still rejects empty input.
- Limit encoded responses by bytes exposed by the native client stream, without comparing compressed Content-Length to decoded bytes. Fetch exposes decompressed bytes; Node's native HTTP transport exposes encoded bytes.
- Keep conditional response caches separate for requests with different query parameters. Refresh pagination Link metadata on 304 responses while reusing cached bodies and decoded values, so lists follow the current next page and stop when its Link disappears.
- Remove userinfo, query strings and fragments from status-error URLs.
- Keep pagination links on the request's origin.
- Release response bodies before returning status or body-size failures, and keep schema failures from holding HTTP connections.
- Release GitHub response bodies on rejection and before refreshing a rejected installation token, so repeated failures do not exhaust the connection pool.

### Breaking

- Effectful `GitHubToken` providers can now fail with `GitHubRateLimited` alongside `GitHubAppError`. Consumers handling authentication failures must also handle `GitHubRateLimited` and use its `retryAt` when scheduling another attempt.
- Bounded response readers reject NaN, infinite and negative limits with the typed `InvalidBodyLimit` error from `errors.ts`. Pass a finite nonnegative byte limit and handle the new failure in the error channel.
- GitHub methods using the bounded response reader also expose `InvalidBodyLimit` from `@shivaedev/http/errors.ts` for invalid byte limits. Supply finite nonnegative limits and handle that failure alongside existing response failures.
- `CreateCheckRun` requires a conclusion when `status` is `completed`, with validation before any request. Consumers creating completed runs must supply `conclusion`; use `queued` or `in_progress` when no conclusion is available.
- `CheckRunStatus` includes `waiting`, `requested` and `pending` from GitHub Actions responses. Consumers with exhaustive status handling must add these cases. GitHub App create and update inputs remain restricted to `queued`, `in_progress` and `completed`.
- Pagination rejects automatic fetch redirects so custom headers cannot reach another origin. Pass a direct same-origin page URL instead of a redirecting URL; links to later pages must also use direct URLs. Other fetch options in the current Effect context are preserved. Use a client without redirect-following middleware.
- GitHub listing methods inherit the redirect restriction. List the repository's current API path instead of an endpoint that redirects after a rename or transfer.

## 0.8.6 - 2026-11-01

### Fixed

- Quality reports HTTP error branches written with `HttpStatus.fromLiteral` outside configured HTTP edges, including comparisons, switch cases and status-list membership.
- GitHub App requests and artifact storage downloads use the shared HTTP status filter while retaining their GitHub error tags and reasons.
- Server OTLP exports use the shared HTTP status filter to reset warning suppression after success and report redacted collector failures.

## 0.8.5 - 2026-11-01

### Changed

- Update `@shivaedev/errors` from 0.4.0 to 0.4.1.

## 0.8.4 - 2026-10-31

### Changed

- Update `@shivaedev/errors` from 0.3.0 to 0.4.0.

## 0.8.3 - 2026-10-31

### Changed

- Update `@shivaedev/errors` from 0.2.0 to 0.3.0.

## 0.8.2 - 2026-10-31

### Changed

- Update `@shivaedev/errors` from 0.1.3 to 0.2.0.

## 0.8.1 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.

## 0.8.0 - 2026-10-30

### Added

- GitHub provides `GitHubToken.fromEnvOrCli`: resolve `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token` through Effect's child-process service. Authentication failures carry `GitHubTokenError` with string reasons and a non-enumerable cause.

### Fixed

- Fleet consumes the shared token provider and pr-watch's typed-failure metadata.
- GitHub transport and artifact failure mappings retain their original non-enumerable cause. Watcher response, state and outage failures retain their causes.

### Breaking

- Replace `GitHubAppError.stage` with string `reason` literals: `sign`, `encode`, `transport`, `status` and `response`. Migrate `stage === "sign"` handlers to `reason === "sign"`; replace `stage === "exchange"` handlers with the appropriate exchange reason. HTTP refusals retain `status`. Caught signing, encoding, transport and response failures retain their original non-enumerable `cause`; keep causes in trusted diagnostics because underlying requests can contain credentials.
- pr-watch preserves GitHub and HTTP errors in its failure channel. Match their original classes or tags instead of expecting every failure to be `WatchError`. Use `requestFailure` for display and retry metadata; it now returns metadata without replacing the error. `WatchError` requires a string `reason`; use `reason: "cooldown"` instead of `retryable: true` for a local cooldown.
- Replace the removed pr-watch `githubToken` Layer with `GitHubToken.fromEnvOrCli` from `@shivaedev/github/GitHubToken.ts`.
- The CLI uses Effect CLI and NodeRuntime. Signal interruption exits with 130 instead of 0; callers that treat interrupted watches as clean shutdowns must accept 130. Help and parse errors use Effect CLI's format. Replace `argumentsFor` and the static `help` export with `program` for CLI execution or `optionsFor` for validation of parsed settings. `program` now requires Effect CLI's standard environment services. `Watcher.poll` diagnostic callbacks now receive the original typed failure; use `requestFailure(failure).message` to render it. `confirmQueue(options, snapshot)` reads `GitHubHttp` from the Effect environment instead of a service parameter.
- Fleet PR watch streams also preserve these typed failures. Consumers that caught only `WatchError` must match the original GitHub or HTTP failure tags, or the existing authentication `ServiceUnavailable` tag.

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
