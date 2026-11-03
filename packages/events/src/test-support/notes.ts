import { Data, Deferred, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { makeEventStore } from "#makeEventStore.ts";
import type { Event } from "#types.ts";

export const Renamed = Schema.Struct({ name: Schema.String });
export const LegacyRenamed = Schema.Struct({ title: Schema.String });

export class Note extends Model.Class<Note>("Note")({ id: Schema.String, name: Schema.String, stream: Schema.String }) {}
export class ProjectionRejected extends Data.TaggedError("ProjectionRejected") {}

export const notes = collection("event_notes", Schema.String);

export const noteMigration = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table event_notes (id text primary key, stream text not null, name text not null)`;
	yield* sql`create table event_audit (id text primary key, stream text not null, name text not null)`;
});

export const noteEngine = Effect.gen(function* () {
	const rows = yield* makeRepository(Note, { collection: notes, idColumn: "id", spanPrefix: "Note", tableName: notes.name });
	const audit = yield* makeRepository(Note, { idColumn: "id", spanPrefix: "Audit", tableName: "event_audit" });
	const resetPause: { current?: { readonly entered: Deferred.Deferred<number>; readonly release: Deferred.Deferred<void> } } = {};
	const projection = {
		apply: (event: Event<typeof Renamed.Type>) =>
			Effect.gen(function* () {
				yield* rows.insertVoid({ id: `${event.stream}/${event.streamVersion}`, name: event.value.name, stream: event.stream });
				if (event.value.name === "Rejected") {
					return yield* Effect.fail(new ProjectionRejected());
				}
			}),
		name: "notes",
		reset: Effect.gen(function* () {
			yield* rows.delete({});
			const pause = resetPause.current;
			if (pause !== undefined) {
				const sql = yield* SqlClient.SqlClient;
				const [backend] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
				yield* Deferred.succeed(pause.entered, backend?.pid ?? 0);
				yield* Deferred.await(pause.release);
			}
		}),
	};
	const options = { name: "notes", schema: Renamed, version: 2 };
	const store = yield* makeEventStore({ ...options, projections: [projection] });
	const auditProjection = {
		apply: (event: Event<typeof Renamed.Type>) =>
			Effect.gen(function* () {
				const current = yield* rows.findMany({ orderBy: { direction: "asc", field: "id" }, where: { stream: event.stream } });
				yield* audit.insertVoid({
					id: `${event.stream}/${event.streamVersion}`,
					name: current.map(({ name }) => name).join(", "),
					stream: event.stream,
				});
			}),
		name: "audit",
		reset: audit.delete({}),
	};
	const auditStore = yield* makeEventStore({ ...options, projections: [auditProjection] });
	const combined = yield* makeEventStore({ ...options, projections: [projection, auditProjection] });
	const history = yield* makeEventStore({ ...options, projections: [] });
	const legacy = yield* makeEventStore({ name: "notes", projections: [], schema: LegacyRenamed, version: 1 });
	const counts = yield* makeEventStore({ name: "counts", projections: [], schema: Schema.Struct({ count: Schema.BigInt }), version: 1 });
	const upgraded = yield* makeEventStore({
		...options,
		projections: [projection],
		upcast: (event) => Schema.decodeUnknownEffect(LegacyRenamed)(event.payload).pipe(Effect.map(({ title }) => ({ name: title }))),
	});
	return { audit, auditStore, combined, counts, history, legacy, resetPause, rows, store, upgraded };
});

export type NoteEngine = Effect.Success<typeof noteEngine>;
