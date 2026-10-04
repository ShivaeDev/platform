# Changelog

## 0.5.0 - 2026-10-04

### Changed

- Consolidate duplicate test cases around observable package behavior.
- The function members of the Better Auth relation and field types are declared as properties, so TypeScript checks their parameters strictly.

- Validate packed consumers and executable bins through the shared workspace gate.

- Replace JSDoc blocks with a short reason comment, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.4.3 - 2026-09-26

### Changed

- Pin the optional `better-auth` peer dependency to 1.6.30, the current 1.6
  release, up from 1.6.25.

## 0.4.2 - 2026-09-26

### Added

- `TooManyRequests` in `@shivaedev/platform/errors`, a rejection with a
  `message` for a caller that exceeded a rate limit. Effect tRPC sends it as
  `TOO_MANY_REQUESTS`, HTTP 429.

### Changed

- Require Effect tRPC 0.4.1, which maps `TooManyRequests` to HTTP 429 and
  marks input-validation rejections with `invalidInput: true`.

## 0.4.1 - 2026-09-26

### Changed

- Pin the optional `better-auth` peer dependency to exactly 1.6.25, the version
  the package is tested against, instead of `^1.6.25`.

## 0.4.0 - 2026-09-26

### Added

- `@shivaedev/platform/errors`: browser-safe Schema error classes shared by native
  RPC contracts, effect-contract rejections and form field rejections.
- `@shivaedev/platform/rpc`: browser-safe request id and identity services plus
  the `RequestTracing`, `Authenticated` and `MaybeAuthenticated` middleware tags.
- `@shivaedev/platform/rpc-server`: middleware layers for request ids, log and
  span annotation, redacted failure logging, Better Auth sessions and an explicit
  Origin policy. The Origin policy and session provider see only the transport
  request's headers, not headers set inside RPC messages; `transportHeaders`
  gives application middleware the same view.

### Changed

- Require Effect Prisma 0.6.4 and Effect tRPC 0.4.0, which adds declared
  rejections to tRPC error data.

## 0.3.8 - 2026-09-26

### Changed

- Require only Effect. Effect Prisma, Effect tRPC, tRPC server, and Effect
  Vitest are now optional peers, so applications that import only the
  `runtime` and `node-http` entries no longer install Prisma Next, tRPC, or
  Vitest. The `better-auth` entry still requires Effect Prisma, and the
  `testing` entry requires all four.
- Accept any Better Auth 1.x release from 1.6.25 instead of exactly 1.6.25.

## 0.3.7 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.
- Require Effect Prisma 0.6.3 and Effect tRPC 0.3.4, which move to the same
  Effect release.

## 0.3.6 - 2026-08-30

### Changed

- Require Effect Prisma 0.6.1 and Effect tRPC 0.3.3, which run Effect tests
  through `@shivaedev/effect-test`.

## 0.3.5 - 2026-08-27

### Changed

- Require Effect Prisma 0.6.0 and carry only the Database service through the
  shared application test transaction.

## 0.3.4 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.
- Require Effect Prisma 0.5.3 and Effect tRPC 0.3.2, which move to the same
  Effect release.

## 0.3.3 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.
- Require Effect Prisma 0.5.2 and Effect tRPC 0.3.1, which move to the same
  Effect release.

## 0.3.2 - 2026-08-12

### Changed

- Require Effect Prisma 0.5.1, so the test harness requirement channel names
  the database executor service again instead of collapsing to `never`.

## 0.3.1 - 2026-08-12

### Changed

- Require Effect Prisma 0.5.0, which adds the experimental SQLite entrypoint
  and UTC decoding for zone-less SQLite datetime values.

## 0.3.0 - 2026-08-03

### Added

- Add a Node/Bun subscription signal that combines Web and procedure aborts
  with request and socket close events for reliable long-lived response cleanup.

## 0.2.3 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.3 so generated timestamp codec references normalize
  to `Date`.

## 0.2.2 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.2 so applications can normalize generated
  timestamp declarations without recursively expanding client types.

## 0.2.1 - 2026-08-03

### Fixed

- Require Effect Prisma 0.4.1 so PostgreSQL timestamp fields use their runtime
  `Date` types throughout the shared application setup.

## 0.2.0 - 2026-08-03

### Added

- Add a shared application runtime that carries Effect services across tRPC,
  Better Auth, and other promise boundaries.
- Add a Better Auth adapter backed by Effect Prisma, including transaction
  propagation and PostgreSQL filter support.
- Add a `promise` test-harness helper for driving promise-based boundaries
  inside the test rollback transaction.

## 0.1.0 - 2026-08-03

### Added

- Add an opinionated Effect Vitest harness that combines typed tRPC callers,
  direct Prisma access, rollback isolation, and application-owned fixtures.
