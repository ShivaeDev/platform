import { Config, type Duration, Effect, Redacted, Ref, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Hydration from "effect/reactivity/Hydration";
import { Migrator, SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { liveClient } from "#test/live/client.ts";
import { liveServer, type NotesSource } from "#test/live/server.ts";
import { Note } from "./notes.ts";

const databaseUrl = Effect.runSync(Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"));
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
		const source = notesSource(sql);
		const server = yield* Effect.acquireRelease(
			Effect.promise(() => liveServer("", { _tag: "Resync" }, source)),
			(host) => Effect.promise(host.close),
		);
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(value) => Effect.sync(() => value.dispose()),
		);
		return { client: liveClient(server.url), registry, server };
	},
	inspect: ({ client, registry, server }) => ({ reads: Effect.runSync(Ref.get(server.reads)), status: registry.get(client.status) }),
	layer,
	name: "committed live notes over HTTP",
	stages: ["consumer"],
	verbs: ({ client, registry, server }, story) => ({
		body: (id: number) => AsyncResult.getOrElse(registry.get(client.api.get.query({ id })), () => undefined)?.body,
		disconnect: () => Effect.promise(server.disconnect),
		edit: (id: number, body: string) => {
			story.tell(`commit note ${id}: ${body}`);
			return Effect.promise(() => server.edit(id, body));
		},
		gateReads: (gate: Effect.Effect<void>) => Ref.set(server.gate, gate),
		list: () => AsyncResult.getOrElse(registry.get(client.api.list.query(undefined)), () => []),
		mount: <A>(atom: import("effect/reactivity/Atom").Atom<A>) => registry.mount(atom),
		open: (window?: Duration.Input) => {
			story.tell(`watch both notes and the list with the ${window ?? "default"} coalescing window`);
			if (window !== undefined) {
				registry.set(client.coalesceWindow, window);
			}
			registry.mount(client.connection);
			registry.mount(client.api.get.query({ id: 1 }));
			registry.mount(client.api.get.query({ id: 2 }));
			registry.mount(client.api.list.query(undefined));
		},
		pause: (value: boolean) => registry.set(client.paused, value),
		reads: () => Effect.runSync(Ref.get(server.reads)),
		received: () => Effect.runSync(SubscriptionRef.get(client.received)).Changed,
		registry,
		restore: () => {
			const saved = Hydration.dehydrate(registry);
			registry.reset();
			Hydration.hydrate(registry, saved);
		},
		resume: () => registry.set(client.resume, registry.get(client.resume) + 1),
		serialized: () => client.api.get.query({ id: 1 }, { serializationKey: "note-one" }),
		shortLived: () => client.api.get.query({ id: 1 }, { timeToLive: "1 second" }),
		status: () => registry.get(client.status),
		waiting: (id: number) => registry.get(client.api.get.query({ id })).waiting,
	}),
});
