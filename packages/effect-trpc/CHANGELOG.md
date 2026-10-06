# Changelog

## Unreleased

### Changed

- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.6.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module outside `internal/` (`src` under the `source` condition, `dist` otherwise), and `"./internal/*": null` keeps `internal/` modules private, so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-trpc`: `@shivaedev/effect-trpc/client/rejection.ts` (`EncodedRejection`), `@shivaedev/effect-trpc/adapter.ts` (`EffectTRPCAdapter`, `EffectTRPCRuntime`, `MakeEffectTRPCOptions`, `makeEffectTRPC`), `@shivaedev/effect-trpc/errors.ts` (`badRequest`, `conflict`, `fail`, `forbidden`, `internalServerError`, `notFound`, `preconditionFailed`, `unauthorized`), `@shivaedev/effect-trpc/procedure.ts` (`EffectProcedureBuilder`), `@shivaedev/effect-trpc/rejection.ts` (`RejectionError`, `RejectWithOptions`, `rejectionCode`, `rejectWith`), `@shivaedev/effect-trpc/rejection-formatter.ts` (`RejectionData`, `RejectionErrorShape`, `rejectionFormatter`, `withRejection`), `@shivaedev/effect-trpc/request-services.ts` (`EffectProcedureRequestServices`, `extendRequestServices`, `makeRequestServices`), `@shivaedev/effect-trpc/request-signal.ts` (`RequestSignal`), `@shivaedev/effect-trpc/types.ts` (`EffectTRPCErrorContext`, `EffectTRPCErrorMapper`, `EffectTRPCInstrument`, `EffectTRPCStreamInstrument`, `ProcedureInfo`, `ProcedureKind`)
  - `@shivaedev/effect-trpc/client`: `@shivaedev/effect-trpc/client/rejection.ts` (`decodeRejection`, `EncodedRejection`, `rejectionOf`)
  - `@shivaedev/effect-trpc/testing`: `@shivaedev/effect-trpc/testing/caller.ts` (`EffectCaller`, `EffectCallerFactory`, `makeEffectCaller`, `makeEffectCallerFactory`), `@shivaedev/effect-trpc/testing/types.ts` (`CallerOptions`, `CallerResult`, `MakeTrpcHarnessItOptions`, `MakeTrpcItOptions`, `TrpcHarnessIt`, `TrpcHarnessTest`, `TrpcHarnessTester`, `TrpcIt`, `TrpcTest`, `TrpcTester`), `@shivaedev/effect-trpc/testing/vitest.ts` (`makeTrpcHarnessIt`, `makeTrpcIt`)

## 0.5.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

## 0.5.0 - 2026-10-04

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.
- The function members of the procedure builder types are declared as properties, so TypeScript checks their parameters strictly.

- Remove a JSDoc block, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax, so classes declare their fields instead of using constructor parameter properties.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.4.1 - 2026-09-26

### Added

- Map the Platform `TooManyRequests` rejection to `TOO_MANY_REQUESTS`, which
  tRPC sends as HTTP 429.
- Mark the `BadRequest` that `rejectionFormatter` sends for an input the
  procedure's schema rejects with `invalidInput: true`, so a client can tell
  input that did not parse from a declared `BadRequest` with a `field`. The
  rest of the rejection is unchanged and still decodes as `BadRequest`.
  `EncodedRejection`, and so `rejectionOf` and the router-typed
  `TRPCClientError` data, type the mark as `invalidInput?: true`.

### Changed

- Reserve `invalidInput` for that mark. `rejectWith` no longer accepts a schema
  whose encoded value has an `invalidInput` field, and `rejectionFormatter`
  strips the key from every declared rejection, which 0.4.0 sent as it was, so
  a handler can neither fake the mark nor turn its rejection into a 500.
  `rejectWith` also requires the encoded value to have a string `_tag`, which
  sending the rejection already required at run time. Both checks happen at
  compile time, so a schema with an encoded `invalidInput` field or without an
  encoded string `_tag` no longer compiles where it used to fail at run time
  or, for `invalidInput`, send a spoofable mark. This stays a patch release
  because such a schema could not be sent correctly before.

## 0.4.0 - 2026-09-26

### Added

- `rejectWith(schema)` sends failures matching a tagged schema to the client as
  a `RejectionError` carrying the schema-encoded value. The tRPC code follows
  the Platform error taxonomy (`NotFound`, `Unauthorized`, `Forbidden`,
  `Conflict`, `PreconditionFailed`, and `AuthUnavailable` as
  `SERVICE_UNAVAILABLE`), otherwise `BAD_REQUEST`, or a `code` option.
  `rejectionCode` exposes that mapping.
- `rejectionFormatter` and `withRejection` add the encoded value to the error
  data as `data.rejection`. An input that fails the procedure's input schema
  becomes a `BadRequest` rejection whose `field` is the first issue's dotted
  path.
- `@shivaedev/effect-trpc/client`, a browser-safe entry that imports only
  Effect: `rejectionOf(error)` reads the encoded rejection from a
  `TRPCClientError` and `decodeRejection(schema)(error)` decodes it.

### Changed

- Require Effect Test 0.1.2, whose `eventually` retries only typed failures.

## 0.3.4 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.
- Require Effect Test 0.1.1, which moves to the same Effect release.

## 0.3.3 - 2026-08-30

### Changed

- Build `makeTrpcIt` and `makeTrpcHarnessIt` on `@shivaedev/effect-test`
  instead of a private Vitest runner.

### Added

- Accept `clock: "live"` on `makeTrpcIt`, `makeTrpcHarnessIt`, and
  `effectTRPC` tests to use wall-clock time instead of TestClock.

## 0.3.2 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.

## 0.3.1 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.

## 0.3.0 - 2026-08-03

### Added

- Add Effect Stream subscriptions with request-scoped Layers, transport
  cancellation, finalizers, tracing, and stream instrumentation.
- Accept a shared application runtime so tRPC calls and other promise-based
  adapters use the same ambient Effect services.

## 0.2.0 - 2026-08-03

### Added

- Build an application-defined Effectful test harness around a typed tRPC
  caller while retaining worker-scoped Layers and standard Vitest variants.

## 0.1.1 - 2026-08-03

### Fixed

- Run consumer instrumentation inside request-scoped Layers so logging and
  tracing hooks can read services derived from the tRPC context.

## 0.1.0 - 2026-08-03

### Added

- Add Effect-native tRPC query and mutation procedures, request Layers, safe
  error handling, instrumentation hooks, and an Effect Vitest caller.
