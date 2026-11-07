import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Effect, Queue } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createDatabaseEngine } from "#test/databaseEngine.ts";
import { inPlace } from "#test/inPlace.ts";
import { adminUrl, configured, ITEMS_KEY, values } from "#test/postgres.ts";

const sessions = Effect.gen(function* () {
	const pool = yield* PgPool.PgPool;
	const pg = yield* PgClient.PgClient;
	const sql = yield* SqlClient.SqlClient;
	const statement = "select pg_backend_pid() as pid, current_setting('application_name') as name";
	const pooled = yield* pool.use((connection) => connection.query(statement));
	const native = yield* pg.unsafe<{ pid: number; name: string }>(statement);
	const generic = yield* sql.unsafe<{ pid: number; name: string }>(statement);
	return {
		backends: new Set([...pooled.rows, ...native, ...generic].map(({ pid }) => pid)).size,
		names: [...pooled.rows, ...native, ...generic].map(({ name }) => name),
	};
});

export const productionServices = storyKit({
	after: { configuration: ({ engine }) => engine.lease() },
	clock: "test",
	*create() {
		const engine = yield* createDatabaseEngine;
		const preparation: Effect.Success<typeof sessions>[] = [];
		engine.options = {
			...engine.fixture.options,
			applicationName: "production-fixture",
			fixtures: Effect.andThen(
				engine.fixture.options.fixtures,
				Effect.tap(sessions, (snapshot) => Effect.sync(() => preparation.push(snapshot))),
			),
			maxConnections: 1,
		};
		return { engine, preparation, readers: new Map<string, { changes: number; results: Queue.Dequeue<readonly { value: string }[], unknown> }>() };
	},
	inspect: ({ preparation, readers }) => ({ preparation, readers: [...readers.keys()] }),
	layer: postgresLayer(adminUrl),
	name: "production SQL fixtures",
	runIf: configured,
	stages: ["configuration"],
	verbs: (state, story) => {
		const { engine } = state;
		return {
			connections: (place: string) => {
				story.tell(`the pool, PostgreSQL client and SQL client in ${place} read their backend and application name`);
				return inPlace(engine, place, sessions);
			},
			openClone: (name: string) => {
				story.tell(`${name} opens its clone`);
				return engine.open(name, "isolated block");
			},
			preparationConnections: () => {
				story.tell("the story reads the PostgreSQL sessions observed during template preparation");
				return Effect.sync(() => [...state.preparation]);
			},
			readItems: (name: string) => {
				story.tell(`the reader in ${name} receives its next items`);
				return Effect.suspend(() => {
					const reader = state.readers.get(name);
					return reader === undefined ? Effect.die(new Error(`Open the reader in ${name} first`)) : Queue.take(reader.results);
				});
			},
			refreshes: (name: string) => {
				story.tell(`the story reads how often the reader in ${name} was told to refresh`);
				return Effect.sync(() => state.readers.get(name)?.changes);
			},
			watchItems: (name: string) => {
				story.tell(`a reader watches items in ${name}`);
				return engine.inBlock(
					name,
					Effect.gen(function* () {
						const reactivity = yield* Reactivity.Reactivity;
						const reader = { changes: 0, results: yield* reactivity.query([ITEMS_KEY], values) };
						const unregister = reactivity.registerUnsafe([ITEMS_KEY], () => {
							reader.changes += 1;
						});
						yield* Effect.addFinalizer(() => Effect.sync(unregister));
						state.readers.set(name, reader);
					}),
				);
			},
			writeItem: (name: string, value: string) => {
				story.tell(`${name} commits the item ${value}`);
				return engine.inBlock(
					name,
					transact(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							yield* sql`update items set value = ${value}`;
							yield* invalidateOnCommit([ITEMS_KEY]);
						}),
						{ onSqlError: (error) => error },
					),
				);
			},
		};
	},
});
