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

### Rate limits and failures

`github.observations()` returns the latest `resource`, `limit`, `remaining`, `used` and UTC `reset` from response headers, including conditional and failed responses. Core and search budgets remain separate. A primary or secondary rate limit fails with `GitHubRateLimited` from `@shivaedev/effect-github/errors.ts`; its `retryAt` is a UTC `DateTime` usable directly by a job scheduler. Requests to a blocked resource fail locally until that instant. Each rate-limited failure records a log and span event with the request path and budget, excluding credentials and query strings.

HTTP status failures use platform's typed `RemoteNotFound`, `RemoteUnauthorized` and other errors from `@shivaedev/platform/http-client/errors.ts`. An oversized body fails with `ResponseBodyTooLarge`; invalid response data fails with `Schema.SchemaError`. Transport failures use `GitHubTransportError`, which contains only the request path.

Install with `pnpm add @shivaedev/effect-github effect`. Choose and provide an Effect HTTP client appropriate to your runtime. Scheduling, retries and application policy stay with the caller.
