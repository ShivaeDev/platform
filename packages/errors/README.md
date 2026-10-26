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

### Masking secrets in failures

`sensitive.ts` decides which names are secret. `isSensitiveKey(key)` matches credential-shaped names whatever their casing or separator, such as `sessionId`, `bearerToken`, `access_key_id` or `cardNumber`. A `SensitiveKey` is any `(key: string) => boolean`, so an application can widen the policy with its own names. `redactText(text, sensitive, maxLength?)` masks credential-shaped text and `key=value` assignments inside a string, and cuts it at 2,048 characters by default; passing `Infinity` keeps complete public text. Masked values become `REDACTED`, the string `<redacted>`.

`redact.ts` applies that policy to structured values. `redact(value, sensitive?)` masks values under sensitive keys and credential text inside strings, summarises large collections and binary data, and stops cyclic payloads at a depth limit; use it for diagnostics. `redactWire(value, sensitive?)` applies the same masking without summaries or truncation; use it for failure data sent to a client.

`redactCause.ts` applies it to Effect causes. `redactCause(cause, sensitive?)` and `redactDiagnosticCause(cause, sensitive?)` rebuild a cause with masked failures and defects, `redactDefect(defect, sensitive?)` masks one defect, and `redactingErrorReporter(reporter, sensitive?)` wraps an Effect error reporter so it only ever receives masked causes.

The policy matches names, not values: it does not scan prose for personal data, so keep secrets out of free text and span names.

### Install and limits

Install `@shivaedev/errors` with `effect` as its peer. The package has no root entry; import the module that defines the name. Every module is browser-safe and depends only on `effect`.
