# Typed settings attached to an entity

Give an entity's settings a successful query value even before the first save. A screen then uses the same editor for defaults and stored values: it never creates a placeholder row or handles a missing-settings state. The application still owns authorization and validation policy.

This recipe uses Schema, a `sql` repository, a `contract` query and command, and a `react` editor over `form` fields. It adds no framework helper. The executable example edits an entity's table title and rows per page over real PostgreSQL and authenticated HTTP.

## Code to read

| Module | Responsibility |
| --- | --- |
| [Schema and contract](../../packages/react/src/test-support/settings-example/contract.ts) | Field defaults, successful query values, entity read keys and typed command rejections. |
| [Repositories and migration](../../packages/react/src/test-support/settings-example/repository.ts) | Existing entity ownership, one settings row per entity, and the upsert conflict target. |
| [Service](../../packages/react/src/test-support/settings-example/Service.ts) | Ownership checks, defaulting reads, validation and transactional upserts with committed invalidation. |
| [Handlers](../../packages/react/src/test-support/settings-example/handlers.ts) | Request identity and authorized live subscriptions. |
| [Host](../../packages/react/src/test-support/settings-example/startHost.ts) | Server's real `appHost`, migrated PostgreSQL, session middleware and HTTP RPC. |
| [Client](../../packages/react/src/test-support/settings-example/makeClient.ts) | Native AtomRpc, contract binding and entity-scoped live invalidation. |
| [Editor](../../packages/react/src/test-support/settings-example/Editor.tsx) | `useEditor`, encoded input, form fields and rendered field errors. |
| [Story kit](../../packages/react/src/test-support/settings-example/story.ts) | PostgreSQL configuration, cloned-database isolation and open-editor traits. |
| [Engine](../../packages/react/src/test-support/settings-example/engine.ts) | Existing signed-in owners as fixture preconditions and independent stored-row observations. |
| [Screens](../../packages/react/src/test-support/settings-example/openScreen.tsx) | Separate registries and DOM drivers for each rendered editor. |
| [HTTP requests](../../packages/react/src/test-support/settings-example/request.ts) | Independent authenticated queries and commands for rejection observations. |
| [React waits](../../packages/react/src/test-support/settings-example/withReact.ts) | Keep asynchronous HTTP and stored-row observations inside React’s `act`. |
| [Verbs](../../packages/react/src/test-support/settings-example/verbs.ts) | Screen actions, rendered readouts and HTTP calls; expectations stay in the spec. |
| [Stories](../../packages/react/src/entitySettings.dom.spec.tsx) | Defaults, insert, live refresh, repeated save, typed field rejection and owner isolation. |

## Declare defaults once

The settings Schema owns the defaults:

```ts
export const Settings = Schema.Struct({
	pageSize: Schema.Number.pipe(Schema.withDecodingDefaultKey(Effect.succeed(25))),
	title: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("Workspace"))),
});
```

`EntitySettings` adds `entityId` to those fields. The repository model reuses them; the form reuses the title field and replaces only the number's input codec with `Schema.NumberFromString`. Defaults come from decoding an empty object with `Settings`, rather than a separate defaults object in the component or service.

## Read an authorized entity, then its settings

The service first loads the entity and checks its owner against the request's user id. An unknown or unowned entity returns typed `Missing`, including when it has no settings row. Only an authorized entity can reach the settings lookup.

If `findById(entityId)` finds no settings, its `NoSuchElementError` branch decodes `Settings` from `{}` and returns those defaults with the entity id. The query succeeds with `EntitySettings` in either case. Database and decoding failures remain typed `Unavailable`; they do not silently become defaults.

The migration makes `entity_settings."entityId"` both a primary key and a foreign key to the entity. `makeRepository` uses `entityId` as its id and conflict column, so the same entity cannot accumulate duplicate settings rows. Reading defaults writes nothing.

## Save through an explicit upsert

After authorization and application validation, the service saves with the repository's conflict operation:

```ts
const { row: saved } = yield* repository.upsert(input, {
	updateColumns: ["title", "pageSize"],
});
yield* invalidateOnCommit(invalidationKeys(SaveSettings.invalidates(input, saved)));
return saved;
```

The whole save effect runs inside `transact({ onSqlError: unavailable })`. The first save inserts a row; later saves update the named settings columns at the same entity id. `updateColumns` deliberately excludes the identity. The command declares `settings.item(entityId)` as its invalidation key, and the query declares the same key as a read dependency. `invalidateOnCommit` publishes that key after the transaction commits.

The handler passes the current `Identity.id` into each service call. The example's explicit `subscribe` RPC authorizes the entity before opening `AppChanges.stream` for its settings key. The client mounts that live connection and invalidates its existing query on hints. A second client's registry therefore reads the committed settings over HTTP and delivers them to its already-open editor. See [live updates](./live-updates.md) for the default session-managed path and other transport choices.

The host’s bearer-token sessions and permissive Origin policy are fixture choices. The handler also composes a test commit gate with the host’s existing `BeforeCommit` hook, preserving its PostgreSQL notification delivery; applications do not need that gate. Use your application's session provider and Origin policy, as described in [request context](./request-context.md).

## Edit fields and preserve typed failures

`useSettingsEditor` mounts the connection and calls the native editor path:

```ts
return useEditor({
	fields: Draft,
	query: client.query,
	runtime: client.Client.runtime,
	save: (input) => client.api.save.run({ entityId: client.entityId, ...input }),
	values,
});
```

`values` turns the numeric page size into encoded text. Each control uses form's `useField`; submit calls `editor.save()`. A missing row needs no special form branch because the query already supplies defaults. The editor shows the queried value as well as its editable draft, so the stories can observe both read delivery and field rendering.

The command declares `InvalidSettings: fieldRejection(Settings)`. The service refuses a page size outside the integer range 1–100 with that typed rejection naming `pageSize`. `useEditor` maps its `{ _tag, field, message }` shape to the matching form field, whose error the component renders beside the input. The rejected draft stays visible and no settings row is stored. This range is application policy, enforced by the service for HTTP callers as well as form submissions.

## Run the evidence

The module-level `storyKit(...)` reads `PLATFORM_SQL_TEST_DATABASE_URL` through Effect Config, as the order example does. Without it the stories skip; a skipped story proves nothing. CI supplies real PostgreSQL and the URL through the repository test runner. For a focused local run after `./script/update`:

```sh
PLATFORM_SQL_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql pnpm --filter @shivaedev/react test src/entitySettings.dom.spec.tsx --maxWorkers=2
```

Each story commits through `appHost` and real HTTP into its own cloned PostgreSQL database. Two independent rendered clients prove defaults without a row, first-save creation and live delivery, and replacement values with exactly one stored row. The first save pauses before commit: an independent SQL connection still sees no row and the reader still shows defaults. Releasing the transaction makes the saved values reach the reader. A rejected submission proves the server error reaches the field without inserting. The ownership story refuses cross-owner queries and saves before and after row creation, while each owner's editor retains its own values. These are DOM render stories; they do not establish browser appearance or a production sign-in flow.
