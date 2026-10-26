# @shivaedev/effect-github

GitHub integrations should share one client instead of repeating token headers, page loops and quota handling in every application. This package turns GitHub REST responses into Schema-decoded Effects and streams while keeping rate limits typed.

## Read GitHub with less application code

Describe the response you need and read it. Unchanged responses reuse their decoded value after ETag revalidation; paged lists fetch as you consume them.

```ts
import { Schema } from "effect";
import { read } from "@shivaedev/effect-github/GitHub.ts";

const Repository = Schema.Struct({ name: Schema.String });
const repository = read("/repos/acme/widgets", Repository);
```

## Using the client

`GitHub` is a native Context service declared with `defineService`. Its Layer owns the conditional response cache and resource observations. Provide an Effect `HttpClient` and a `GitHubToken` once, then use the Schema-aware `read`, `list` and `write` functions. Schema decoding services remain visible in their requirements.

```ts
import { Effect, Layer, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub, list, read, write } from "@shivaedev/effect-github/GitHub.ts";
import { GitHubToken } from "@shivaedev/effect-github/GitHubToken.ts";

const github = GitHub.layer.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(GitHubToken.fromEnv),
);
const Issue = Schema.Struct({ number: Schema.Number, title: Schema.String });
const program = Effect.gen(function* () {
  const issue = yield* read("/repos/acme/widgets/issues/1", Issue);
  const first = yield* list("/repos/acme/widgets/issues", Issue).pipe(
    Stream.take(1),
    Stream.runCollect,
  );
  const created = yield* write("POST", "/repos/acme/widgets/issues", { title: "A new issue" }, Issue);
  return { issue, first, created };
});

await Effect.runPromise(program.pipe(Effect.provide(github)));
```

`GitHubToken.fromEnv` reads `GH_TOKEN`, then `GITHUB_TOKEN`, through Effect Config. If neither is set, requests are unauthenticated. To supply a token directly, provide `GitHubToken` with `Option.some(Redacted.make(token))`; use `Option.none()` for anonymous access. Requests send `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28`.

The default base URL is `https://api.github.com`. Provide `GitHubConfig` from `@shivaedev/effect-github/GitHubConfig.ts` with `{ apiUrl }` for another GitHub API endpoint.

`read(path, schema)` decodes a JSON response. `list(path, itemSchema)` returns a Stream of decoded items across GitHub's Link pages, and stops fetching when consumption stops. `write(method, path, body, schema)` sends JSON with `POST` or `PATCH` and decodes its response. JSON response bodies are bounded at 1 MiB. The conditional cache holds up to 1000 representations and keeps decoded values separate for each Schema.

For diffs and artifacts, obtain the service and call `text(path, accept, byteLimit)` or `bytes(path, accept, byteLimit)`. Both bound the body before returning it and use your chosen media type.

```ts
const diff = Effect.gen(function* () {
  const github = yield* GitHub;
  return yield* github.text("/repos/acme/widgets/pulls/1", "application/vnd.github.diff", 256 * 1024);
});
```

The service's `read(path)` and `write(method, path, body)` return a representation with a generic `decode(schema)` method. Its `list(path)` returns an Effect containing a Stream of page representations. Prefer the exported functions for Schema-decoded items. A caller with a pacing policy can pass `github.list(path, beforeRequest)`: the callback receives the resource name before each page request, and its typed failure stops the stream. `github.resource(path)` returns the observed resource for that path, defaulting to core or search before the first response.

### Acting as a GitHub App

Provide `githubApp` as the `GitHubToken` Layer to authenticate the same client as an installation. Give it the App ID, a PEM private key wrapped in `Redacted`, and an installation ID. This uses Node's built-in crypto; no JWT or Octokit dependency is needed.

```ts
import { Layer, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub } from "@shivaedev/effect-github/GitHub.ts";
import { githubApp } from "@shivaedev/effect-github/githubApp.ts";

const appClient = (privateKey: Redacted.Redacted<string>) => GitHub.layer.pipe(
  Layer.provide(githubApp({ appId: "123456", privateKey, installationId: 7 })),
  Layer.provide(FetchHttpClient.layer),
);
```

Alternatively, pass `{ appId, privateKey, owner: "acme", repository: "widgets" }`. The Layer resolves the installation through `GET /repos/{owner}/{repo}/installation` before exchanging the App JWT for an installation token. The RS256 JWT carries the App ID as `iss`, `iat` 60 seconds before the current time, and `exp` ten minutes ahead.

`GitHubToken` accepts a static Option or a lazy Effect returning one; the client resolves it on each request. Code that reads the service directly must evaluate an Effect value before inspecting the Option, using `Effect.isEffect(value) ? yield* value : value`.

The token is fetched on the first request and reused until five minutes before `expires_at`, using Effect's Clock. Concurrent requests share the in-flight exchange, including at refresh. A rejected exchange fails with `GitHubAppError` from `errors.ts`; a 401 has `{ stage: "exchange", status: 401 }`. Signing failures have `stage: "sign"`. These errors and their logs and spans contain no private key, App JWT or installation token.

### Verifying webhooks

Pass the raw request bytes and the `X-Hub-Signature-256` header to `verifyWebhook` before parsing the body. It checks HMAC SHA-256 with a constant-time comparison, then decodes JSON with your Schema. A missing header, tampered body or wrong secret fails with `GitHubWebhookSignatureError` before Schema decoding.

```ts
import { Redacted, Schema } from "effect";
import { verifyWebhook } from "@shivaedev/effect-github/verifyWebhook.ts";

const WorkflowRun = Schema.Struct({
  action: Schema.String,
  workflowRun: Schema.Struct({ id: Schema.Number, conclusion: Schema.String }),
}).pipe(Schema.encodeKeys({ workflowRun: "workflow_run" }));
const receiveWorkflowRun = (
  rawBody: Uint8Array,
  signature: string | undefined,
  secret: Redacted.Redacted<string>,
) => verifyWebhook(rawBody, signature, secret, WorkflowRun);
```

This decodes a signed `workflow_run` delivery with the fields the application needs. Keep the body bytes as received: parsing and reserializing JSON changes what was signed.

### Sticky comments and check runs

Use the service's `upsertStickyComment` to keep a report in one pull-request comment. Pass a marker name; the method prefixes the body with `<!-- name -->`, searches comment pages, and edits the first match. It creates a comment when no match exists. By default the marker can appear anywhere in the existing body. An optional `author` login restricts matching to that author's comments, leaving another author's report alone.

For a GitHub App, pass its numeric `appId`. Matching then requires the body to start with the marker, `performed_via_github_app.id` to equal that App ID, and `user.type` to be `"Bot"`. This replaces an application-owned comment scan and ownership predicate. The optional `author` login further restricts matching when supplied.

```ts
const report = Effect.gen(function* () {
  const github = yield* GitHub;
  return yield* github.upsertStickyComment({
    owner: "acme", repo: "widgets", number: 1,
    marker: "coverage", appId: 123456,
    body: "Coverage: 90%",
  });
});
```

`createCheckRun(owner, repo, input)` creates a check for `headSha` with a name and status. `updateCheckRun(owner, repo, id, input)` moves it to `in_progress` or `completed`; completion requires a conclusion. Output contains `title`, `summary` and optional `text`. Request and response Schemas are exported from `checkRuns.ts`.

```ts
const check = (headSha: string) => Effect.gen(function* () {
  const github = yield* GitHub;
  const created = yield* github.createCheckRun("acme", "widgets", {
    headSha, name: "Coverage", status: "queued",
  });
  yield* github.updateCheckRun("acme", "widgets", created.id, {
    status: "in_progress", output: { title: "Coverage", summary: "Measuring" },
  });
  return yield* github.updateCheckRun("acme", "widgets", created.id, {
    status: "completed", conclusion: "success",
    output: { title: "Coverage", summary: "90% covered", text: "All targets measured" },
  });
});
```

### Rendering untrusted text

Use the pure helpers from `markdown.ts` for test names and error messages. `plainText` encodes ASCII punctuation as HTML entities, including HTML delimiters and link syntax, and adds a zero-width separator after `@` and `#` to prevent mentions and issue references. `codeSpan` chooses a backtick fence longer than any run in the input and flattens line endings to spaces. `tableCell` flattens line endings and protects pipes; pass `"code"` for a code span inside a table cell. Emoji are preserved.

```ts
import { tableCell } from "@shivaedev/effect-github/markdown.ts";
import { renderRows } from "@shivaedev/effect-github/markdownRows.ts";

const rows = failures.map(({ name, error }) =>
  `| ${tableCell(name)} | ${tableCell(error, "code")} |`,
);
const summary = renderRows(rows, {
  header: "| Test | Error |\n| --- | --- |",
  byteLimit: 8_000,
});
```

`renderRows` accepts already-rendered rows and a trusted Markdown header. It counts UTF-8 bytes, keeps a prefix of complete rows and, when rows are dropped, appends one `and N more` paragraph. The header and notice count toward the budget; rows, emoji and escapes are never sliced. The default budget is 60,000 bytes. A budget too small for the header and notice throws `RangeError`.

Use the result as a sticky comment body or check-run summary. The budget covers the rendered body; account for any surrounding text, including the sticky comment marker, when choosing a lower total limit.

### Rate limits and failures

`github.observations()` returns the latest `resource`, `limit`, `remaining`, `used` and UTC `reset` from response headers, including conditional and failed responses. Core and search budgets remain separate. A primary or secondary rate limit fails with `GitHubRateLimited` from `@shivaedev/effect-github/errors.ts`; its `retryAt` is a UTC `DateTime` usable directly by a job scheduler. Requests to a blocked resource fail locally until that instant. Each rate-limited failure records a log and span event with the request path and budget, excluding credentials and query strings.

A 403 with `"Resource not accessible by integration"` fails with `GitHubPermissionDenied`; a locked-conversation 403 fails with `GitHubConversationLocked`. Both come from `@shivaedev/effect-github/errors.ts` and carry the request `path`. Rate-limit detection takes precedence. Other 403s remain `RemoteHttpError`. Applications can handle these tags instead of parsing GitHub error messages:

```ts
const publishReport = report.pipe(
  Effect.catchTag("GitHubPermissionDenied", ({ path }) =>
    Effect.succeed({ published: false, reason: "permissions", path }),
  ),
  Effect.catchTag("GitHubConversationLocked", ({ path }) =>
    Effect.succeed({ published: false, reason: "locked", path }),
  ),
);
```

Other HTTP status failures use platform's typed `RemoteNotFound`, `RemoteUnauthorized` and other errors from `@shivaedev/platform/http-client/errors.ts`. An oversized body fails with `ResponseBodyTooLarge`; invalid response data fails with `Schema.SchemaError`. Transport failures use `GitHubTransportError`, which contains only the request path.

Install with `pnpm add @shivaedev/effect-github effect`. Choose and provide an Effect HTTP client appropriate to your runtime. Scheduling, retries and application policy stay with the caller.
