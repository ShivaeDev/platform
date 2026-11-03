# @shivaedev/events

Keep durable history for the features that need to explain how they got here. Commands record versioned Effect Schema values and update ordinary SQL repositories together; stored events can rebuild those rows later.

## History with ordinary live queries

A rename can leave both its history and its read model in one commit:

```ts
yield* notes.append({
	stream: "note-123",
	requestId: "rename-456",
	expectedVersion: 0,
	events: [{ name: "Published" }],
});
```

The projection writes through `@shivaedev/sql`, so existing queries refresh through their usual change keys. Ordinary features can keep using SQL directly.

## Using it

A store groups streams with one event schema and a set of named projections. A stream starts at version zero and advances once per event. The schema version describes the payload format; it is independent of the stream version.

### Set up PostgreSQL

Install the optional package alongside your SQL stack:

```sh
pnpm add @shivaedev/events @shivaedev/sql effect @effect/sql-pg
```

Add `postgresMigration` from `@shivaedev/events/postgresMigration.ts` as one entry in your application's native migration loader. Run that loader with `migratePostgres` as usual. This creates the event, request, stream and projection-progress tables. The application owns its read-model migrations and PostgreSQL Layer.

### Define a feature

Describe the current event with Effect Schema, create ordinary repositories, then construct the store in the application's SQL environment:

```ts
import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { makeEventStore } from "@shivaedev/events/makeEventStore.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

class Note extends Model.Class<Note>("Note")({
	id: Schema.String,
	name: Schema.String,
}) {}

const Renamed = Schema.Struct({ name: Schema.String });

const makeNotes = Effect.gen(function* () {
	const rows = yield* makeRepository(Note, {
		conflictColumns: ["id"],
		idColumn: "id",
		spanPrefix: "Note",
		tableName: "notes",
	});
	return yield* makeEventStore({
		name: "notes",
		schema: Renamed,
		version: 1,
		projections: [
			{
				name: "names",
				apply: ({ stream, value }) => rows.upsert({ id: stream, name: value.name }).pipe(Effect.asVoid),
				reset: rows.delete({}),
			},
		],
	});
});
```

The application creates the `notes` table before acquiring this store. Keep store and projection names stable: they identify durable history and progress. Use a tagged schema union when a feature emits several event types.

Projection `apply` receives `{ stream, streamVersion, requestId, value }`. `apply` and `reset` are database-only Effects: their service requirements allow SQL and Reactivity, with application failures retained in the error channel. Keep HTTP calls, jobs, email and other external effects outside projections, including services captured in closures. Rebuild invokes only `reset` and `apply`; it never runs command handlers. Replay order is stream name followed by stream version, so projections must not depend on a total order across streams.

### Append from a command

Call `append({ stream, requestId, expectedVersion, events })` with a batch. It returns the resulting stream version. Events, request recognition, projection progress and repository writes share `sql.transact`. A projection failure rolls them all back, including earlier events in the batch. An enclosing transaction must also use `transact`.

When a command decides the state already matches, pass `events: []`. The same transaction checks `expectedVersion` and durably records the request receipt at that version, including version zero for an empty stream. It appends no event, runs no projection (including pending projection work) and publishes no change keys.

Choose a stable request id before retrying a command. It is unique across the store. `AlreadyDone` from `errors.ts` carries the original `stream`, `streamVersion` and `requestId`; handle it as a completed request. It takes precedence over a stale expected version. `StreamConflict` carries `stream`, `expectedVersion` and `actualVersion`; reload the stream and decide the command again. Concurrent PostgreSQL writers use the same checks.

An empty batch has the same request recognition: retrying it returns `AlreadyDone` with its original version even after a newer event changes the stream. Use that version with `read(stream)` to recover the original result from history instead of returning the latest projection. The retry leaves newer events and projections untouched.

### Read, catch up and rebuild

`read(stream)` returns decoded events in stream-version order. `catchUp` applies events missing from each named projection, tracking progress separately for each stream. Call it when adding a projection or consuming history written by a store configuration without that projection. Calling it again does not reapply events. An event that was uncommitted during a pass remains eligible for the next pass; there is no global sequence high-water mark.

`rebuild` resets the configured read models, clears their progress and replays stored events in one transaction. Its PostgreSQL table lock excludes appends and catch-up writes while rebuilding, across stores sharing these tables. This is an offline rebuild, so schedule it when blocking writes is acceptable. Each projection's reset must clear only the rows it owns.

### Evolve event payloads

Increase the schema version for new writes and provide `upcast` to turn an older encoded payload into the current encoded shape:

```ts
const options = {
	name: "notes",
	schema: Schema.Struct({ name: Schema.String }),
	version: 2,
	upcast: ({ payload }: { readonly version: number; readonly payload: unknown }) =>
		Schema.decodeUnknownEffect(Schema.Struct({ title: Schema.String }))(payload).pipe(Effect.map(({ title }) => ({ name: title }))),
	projections: [],
};
```

The store calls the upcaster only for a different stored version, then decodes its result with the current schema's JSON codec. Without an upcaster it fails with `UnsupportedEventVersion`. For several historical versions, branch on the supplied version and compose the necessary transformations. Upcasters require no services and must perform no external effects. Stored payloads remain unchanged.
