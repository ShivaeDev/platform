# @shivaedev/errors

Shared expected failures and secret-safe failure reporting for Effect applications. Every layer of an application declares, returns and reads the same tagged error classes, and every boundary that reports a failure masks secrets the same way.

## Why you want this

An application that lets each feature invent its own "not found" or "name is taken" ends up with a dozen shapes for the same answer, and every client screen has to learn each one. A shared vocabulary means an RPC declares the failures it can return, the handler fails with one of them, and the client reads the same class back with its field and message intact.

```ts
import { rejectedField } from "@shivaedev/errors/rejectedField.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";

const field = rejectedField(new Conflict({ field: "name", message: "Name is taken" }));
```

`field` is `Option.some({ field: "name", message: "Name is taken" })`, ready to show beside the form input it names. The same modules run in the browser and on the server.

## Using it

### How to think about it

There are two kinds of failure. Expected failures are part of an operation's contract: the caller can act on them, so they carry a public message and travel to the client. Unexpected failures are defects and causes the caller cannot act on; they go to logs, traces and error reporters, and anything secret in them must be masked first. This package holds the vocabulary for the first kind and the masking policy for the second.

### Expected failures

`taxonomy.ts` exports `NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests`, `AuthUnavailable`, `InternalServerError` and `ServiceUnavailable`. Each class is a Schema tagged error with a string `message`; `BadRequest` and `Conflict` also accept an optional string `field`. Declare only the failures an operation can return:

```ts
import { Schema } from "effect";
import { Rpc } from "effect/rpc";
import { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";

export const Rename = Rpc.make("Rename", {
	error: Schema.Union([BadRequest, Conflict]),
	payload: { name: Schema.String },
	success: Schema.String,
});
```

A handler fails with `new Conflict({ field: "name", message: "Name is taken" })`, and native RPC JSON decodes the rejection back to the error instance with its field. `rejectedField(error)` reads either that instance or its tagged JSON. Any value with a string `_tag`, `field` and `message` qualifies, including an application's own tagged error; an untagged object, a missing field or a non-string field yields `Option.none()`.

Each class has an `is<Class>` guard in `taxonomy.ts`, such as `isConflict(value)`. Guards narrow actual instances, including errors decoded by the class schema; an object with the same `_tag` and fields does not qualify. Use them with `Effect.catchIf(isConflict, handler)` when matching a taxonomy failure by class.

### Mapping unexpected failures at the handler edge

Use `rpcBoundary` only at the RPC handler edge, never inside services. Services keep their typed failures and defects so callers can handle them. At that edge, `rpcBoundary(schema, options)` keeps declared rejections and maps other failures and defects into one declared fallback. It leaves successful values and interruption intact:

```ts
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Conflict, InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";

const Rejection = Schema.Union([Conflict, InternalServerError]);
const expose = rpcBoundary(Rejection, {
	unexpected: (message) => new InternalServerError({ message }),
});

const Api = RpcGroup.make(
	Rpc.make("Save", {
		error: Rejection,
		success: Schema.String,
	}),
);

export const Handlers = Api.toLayer({
	Save: () => storageSave.pipe(expose),
});
```

`storageSave` is the application's Effect. `unexpected` constructs a member of the declared schema from the public message. The default message is `Internal server error`; `message` supplies application text, with credential-shaped strings redacted. Before masking an unexpected failure, the boundary reports its diagnostic-redacted cause through Effect's registered `ErrorReporter`s at `Error` severity. Request tracing logs that masked failure at ERROR with its redacted stack, while declared rejections stay at INFO. The original Effect cause is kept on the server rejection's non-enumerable `cause`, so a server span can trace it. Keep `cause` out of the wire schema, as the taxonomy classes do. `ServiceUnavailable` describes a declared availability failure without implying a session-provider outage.

Apply the same boundary to an entire handler registration with `rpcBoundaryHandlers(group, boundary, handlers)`:

```ts
import { rpcBoundaryHandlers } from "@shivaedev/errors/rpcBoundaryHandlers.ts";

export const Handlers = Api.toLayer(
	rpcBoundaryHandlers(Api, expose, {
		Save: () => storageSave,
	}),
);
```

The group supplies payload and result types. Each RPC must declare the boundary's rejection schema. Effect and Stream handlers share the mapping, including failures after a stream has delivered values; native `Rpc.Wrapper` options remain available. Handler service requirements pass through to the native handler Layer. Use this map inside an Effect passed to `toLayer` when handler construction needs services. Queue-backed streams and Deferred results use native handlers with an explicit boundary at their producer instead.

### Masking secrets in failures

`sensitive.ts` decides which names are secret. `isSensitiveKey(key)` matches credential-shaped names whatever their casing or separator, such as `sessionId`, `bearerToken`, `access_key_id` or `cardNumber`, and database diagnostic keys `db.user`, `db.user.name` and `db.connection_string`. A `SensitiveKey` is any `(key: string) => boolean`, so an application can widen the policy with its own names. `redactText(text, sensitive, maxLength?, key?)` masks credential-shaped text and `key=value` assignments inside a string, URL user information, query values and fragments, and cuts it at 2,048 characters by default; passing `Infinity` keeps complete public text. The optional `key` supplies context for standalone URL components such as `url.query`. `redactUrl(value, key?)` from `sensitive.ts` applies just the URL rules, including nested JSON strings. Masked values become `REDACTED`, the string `<redacted>`.

Schema diagnostics receive additional masking: `redactText` masks rejected values after `got` or `Expected …, actual …`, before URL masking and truncation. Expected types and schema paths remain readable. Structured redaction also masks the native Schema issue tree's reported `input` values, so those values do not reappear in error reports.

`redact.ts` applies that policy to structured values. `redact(value, sensitive?)` masks values under sensitive keys and credential text inside strings, summarises large collections and binary data, and stops cyclic payloads at a depth limit; use it for diagnostics. `redactRecord(values, sensitive?)` masks every top-level record entry without limiting the number of keys, while applying diagnostic limits within each value. `redactWire(value, sensitive?)` applies the same masking without summaries or truncation; use it for failure data sent to a client.

`redactCause.ts` applies it to Effect causes. `redactCause(cause, sensitive?)` rebuilds a cause with masked defects and keeps its typed failures, interruptions and annotations as they are, so the failure channel keeps its type. `redactDiagnosticCause(cause, sensitive?)` masks failures, defects and annotations for diagnostics, `redactDefect(defect, sensitive?)` masks one defect, and `redactingErrorReporter(reporter, sensitive?)` wraps an Effect error reporter so it only ever receives diagnostic-masked causes.

`schemaSensitiveKeys(group, extraKeys?)` from `schemaSensitiveKeys.ts` derives the key predicate from native RPC payload, success, error, defect and middleware error schemas. It includes nested sensitive annotations, Redacted schemas, encoded field names and additional application keys. The predicate’s `forRpc(tag)` method selects the schema-derived policy for one RPC; additional application keys apply to every RPC. The predicate’s `maskFailure(tag, reason)` method identifies whole error or defect roots that need masking. The host applies this predicate to logs, error reports, RPC failure data and exported traces.

Use `yield* schemaSensitiveKeys(group, extraKeys)` to obtain the predicate. Each schema derives its encoded sensitive names independently. Masking a containing field does not independently mark its child names sensitive; native `OptionFromNullOr` encoding preserves those field scopes. Different RPC methods can use the same field name with different sensitivity. Within one RPC, diagnostics carry plain values without schema identity, so a sensitive name cannot also name a public field in its payload, success, failure or middleware schemas, including nested fields. The Effect fails with `SensitiveFieldConflict` from `schemaFieldScope.ts`, naming both schema paths. Rename one field or mark both sensitive. Explicit application keys and built-in credential rules apply everywhere and do not create mixed visibility.

The policy matches names and credential or URL shapes, not arbitrary values: it does not scan prose for personal data, so keep secrets out of free text and span names.

### Install and limits

Install `@shivaedev/errors` with `effect` as its peer. The package has no root entry; import the module that defines the name. Every module is browser-safe and depends only on `effect`.
