import { Config, type Duration, Effect, Redacted } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { Migrator, SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { liveServer, type NotesSource } from "#test/live/server.ts";
import { connect, holdReReadOfNoteOne, type LiveView, liveSnapshot, makeLiveEngine, watch } from "./liveEngine.ts";
import { liveNotesVerbs } from "./liveNotesVerbs.ts";
import { Note } from "./notes.ts";

const databaseUrl = Effect.runSync(Config.String("PLATFORM_SQL_TEST_DATABASE_URL"));
const layer = makePostgresTestLayer({
	migrations: {
		loader: Migrator.fromRecord({
			"1_notes": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create table notes (id integer primary key, title text not null, body text not null)`;
				yield* sql`insert into notes values (1, 'One', 'First'), (2, 'Two', 'Second')`;
			}),
		}),
		lockTimeout: "5 seconds",
	},
	url: Redacted.make(databaseUrl),
});

function notesSource(sql: SqlClient.SqlClient): NotesSource {
	return {
		edit: (id, body) => Effect.runPromise(sql.withTransaction(sql`update notes set body = ${body} where id = ${id}`)).then(() => undefined),
		get: (id) =>
			Effect.runPromise(
				sql<Note>`select * from notes where id = ${id}`.pipe(
					Effect.map((rows) => {
						const row = rows[0];
						if (row === undefined) {
							throw new Error(`Missing note ${id}`);
						}
						return new Note(row);
					}),
				),
			),
		list: () => Effect.runPromise(sql<Note>`select * from notes order by id`.pipe(Effect.map((rows) => rows.map((row) => new Note(row))))),
	};
}

export const postgresLive = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const sql = yield* SqlClient.SqlClient;
		const server = yield* Effect.acquireRelease(
			Effect.promise(() => liveServer("", notesSource(sql))),
			(host) => Effect.promise(host.close),
		);
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(value) => Effect.sync(() => value.dispose()),
		);
		return makeLiveEngine(server, registry);
	},
	inspect: liveSnapshot,
	layer,
	name: "committed live notes over HTTP",
	stages: ["consumer", "views", "connection", "after"],
	verbs: liveNotesVerbs,
});

export function coalescingWindow(window: Duration.Input) {
	return postgresLive.trait("consumer", `the client's changed hints share a ${String(window)} window`, (engine) => {
		engine.registry.set(engine.client.coalesceWindow, window);
	});
}

export function watching(...views: readonly LiveView[]) {
	return postgresLive.trait("views", `the client watches ${views.join(", ")}, each read once from PostgreSQL`, (engine) => watch(engine, views));
}

export function connected() {
	return postgresLive.trait("connection", "the client's live connection has handled its first hint and re-read its views", connect);
}

export function heldReReadOfNoteOne() {
	return postgresLive.trait("after", "the server holds every note read, and note 1's committed edit to In flight is being re-read", (engine) =>
		holdReReadOfNoteOne(engine, "every note read"),
	);
}

export function heldNextReReadOfNoteOne() {
	return postgresLive.trait(
		"after",
		"the server holds only the next note read, and note 1's committed edit to In flight is being re-read",
		(engine) => holdReReadOfNoteOne(engine, "next note read"),
	);
}
