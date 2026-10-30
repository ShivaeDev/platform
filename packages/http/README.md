# @shivaedev/http

Bounded bodies, typed status failures and paginated requests for Effect's HTTP client and server. Calls to outside APIs and native routes stay on `effect/http`, without unbounded reads or untyped status checks.

## Why you want this

A remote API that answers with a 2 GB body, a 429 or a `Link` header to page 2 is ordinary, and every integration ends up writing the same size checks, status mapping and pagination loop. This package writes them once: responses become typed failures you can match on, and no body is read past the limit you set.

```ts
import { Effect, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedJson } from "@shivaedev/http/body.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import { paginate } from "@shivaedev/http/paginate.ts";

const items = Effect.gen(function* () {
	const client = filterStatus(yield* HttpClient.HttpClient);
	return yield* paginate(client, HttpClientRequest.get("https://api.example/items")).pipe(
		Stream.mapEffect((response) => readBoundedJson(response, 64 * 1024, Schema.Array(Schema.String))),
		Stream.runCollect,
		Effect.map((pages) => pages.flat()),
	);
});
```

`items` collects every page, fails with `RemoteRateLimited` when the API throttles, and never reads more than 64 KiB per page.

## Using it

### How to think about it

Everything here wraps a native `HttpClient`, `HttpClientResponse` or `HttpServerRequest`; nothing replaces them. Provide a native client Layer such as `FetchHttpClient.layer` from `effect/http`, compose the helpers onto it, and handle the typed failures they add to the error channel.

### Calling outside APIs

`filterStatus(client)` passes 2xx responses through and fails other statuses with Schema tagged errors from `errors.ts`: `RemoteUnauthorized` (401), `RemoteNotFound` (404), `RemoteGone` (410), `RemoteRateLimited` (429, or 503 carrying `Retry-After`) and `RemoteHttpError` for other statuses. Errors carry the method, the URL without its query string and the status, without headers or body. `RemoteRateLimited.retryAfter` is an optional UTC `DateTime`: delay-seconds use Effect's clock, and HTTP dates name the instant directly. Missing or invalid values leave it undefined; `parseRetryAfter(header, now)` exposes the same parsing.

`paginate(client, request)` follows quoted or unquoted `rel=next`, including headers with multiple links and relations, resolves relative links and stops at the last page. Taking one page sends one request. A next link on another origin fails with `PaginationLinkError` before that request is sent. `nextLink(header)` exposes the link parsing.

`readBoundedBody(response, limit)` returns bytes; `readBoundedText` decodes UTF-8, and `readBoundedJson(response, limit, schema)` decodes JSON through the supplied Schema. Limits are bytes. An oversized `Content-Length` fails with `ResponseBodyTooLarge` before reading the body; a chunked body that exceeds the limit fails during the read. The error carries `limit`.

### Reading request bodies on a native route

For a native Node HTTP route, use `readBoundedBody` from `server/boundedBody.ts` with Effect's `HttpIncomingMessage.MaxBodySize`. It returns an `ArrayBuffer` without decoding the bytes:

```ts
import { ByteSize, Effect } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerResponse } from "effect/http";
import { readBoundedBody } from "@shivaedev/http/server/boundedBody.ts";

const routes = HttpRouter.add("POST", "/webhook", (request) =>
	readBoundedBody(request).pipe(
		Effect.map((body) => HttpServerResponse.uint8Array(new Uint8Array(body))),
		Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(64 * 1024)),
	),
);
```

Oversized `content-length` headers are rejected before reading. Native Effect owns body collection and connection cleanup after chunked overflow; connection reuse depends on its unread-body drain limit. `RequestBodyTooLarge` is a typed failure that implements Effect's `HttpServerRespondable` protocol with status 413. Consume the body once through this reader and decode the result in the application.

### Install and limits

Install `@shivaedev/http` with `effect` as its peer. The package has no root entry; import the module that defines the name.
