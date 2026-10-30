import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Schedule, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine, Services } from "./databaseEngine.ts";

export type Ending = "succeeds" | "fails with rejected" | "dies with assertion failed";

const endings: Record<Ending, Effect.Effect<void, string>> = {
	"dies with assertion failed": Effect.die(new Error("assertion failed")),
	"fails with rejected": Effect.fail("rejected"),
	succeeds: Effect.void,
};

const values = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from items order by id`;
	return rows.map(({ value }) => value);
});

const noteValues = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from notes order by value`;
	return rows.map(({ value }) => value);
});

const tableNames = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ name: string }>`select table_name as name from information_schema.tables
		where table_schema = 'public' order by table_name`;
	return rows.map(({ name }) => name);
});

const ledger = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ id: number }>`select migration_id as id from effect_sql_migrations order by migration_id`;
	return rows.map(({ id }) => id);
});

const nextValue = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const [row] = yield* sql<{ id: number }>`select nextval('test_ids')::int as id`;
	return row?.id;
});

export function writeItem(value: string) {
	return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`);
}

class Items extends Context.Service<Items, { readonly rename: (value: string) => Effect.Effect<void, unknown> }>()("@test/Items") {}
const itemsLayer = Layer.effect(
	Items,
	Effect.map(SqlClient.SqlClient, (sql) => ({ rename: (value: string) => Effect.asVoid(sql`update items set value = ${value}`) })),
);

export function inPlace<A, E>(engine: DatabaseEngine, place: string, effect: Effect.Effect<A, E, Services | Scope.Scope>) {
	if (place === "the shared database") {
		return engine.run(Effect.scoped(effect));
	}
	if (place === "a new clone") {
		return engine.run(withIsolatedDatabase(effect));
	}
	return engine.inBlock(place, effect);
}

export function databaseVerbs(engine: DatabaseEngine, story: Story<DatabaseEngine>) {
	const admin = engine.admin;
	const awaitCleanup = engine.run(Effect.flatMap(PostgresTestDatabase, (database) => database.awaitCleanup));
	function roleOf(name: string) {
		if (name === engine.shared) {
			return "the shared database";
		}
		return name === engine.template ? "the migrated template" : "the empty template";
	}
	function exists(name: string) {
		return Effect.map(admin`select 1 from pg_database where datname = ${name}`, (rows) => (rows.length > 0 ? "exists" : "dropped"));
	}
	return {
		adminSessions: () => {
			const sessions = admin<{ count: number }>`select count(*)::int as count from pg_stat_activity
				where application_name = ${engine.marker} and datname = current_database()`;
			// PostgreSQL removes a closed session after the client's Terminate message and signals nothing when it does.
			return sessions.pipe(
				Effect.repeat({ schedule: Schedule.spaced("10 millis"), times: 500, while: ([row]) => row?.count !== 0 }),
				Effect.map(([row]) => (row?.count === 0 ? "none open" : `${row?.count} open`)),
			);
		},
		appliedMigrations: (place: string) => inPlace(engine, place, ledger),
		blockOutcome: (block: string) => Effect.sync(() => engine.endings.get(block) ?? "still running"),
		buildItemsServiceAndRename: (value: string, place: string) => {
			story.tell(`an application Layer built in ${place} renames the item to "${value}"`);
			return inPlace(engine, place, Effect.flatMap(Items, (service) => service.rename(value)).pipe(Effect.provide(Layer.fresh(itemsLayer))));
		},
		cloneDatabase: (block: string) =>
			Effect.gen(function* () {
				yield* awaitCleanup;
				return yield* exists((yield* engine.block(block)).database);
			}),
		closeWorker: () => {
			story.tell("the worker closes its PostgreSQL test Layer");
			return engine.close();
		},
		databasesDuringPreparation: () => Effect.sync(() => engine.ownDatabases.map(roleOf).sort()),
		end: (block: string, ending: Ending) => {
			story.tell(`${block} ${ending}`);
			return engine.end(block, endings[ending]);
		},
		finalizerQuery: () => Effect.sync(() => engine.finalizerQuery),
		interrupt: (block: string) => {
			story.tell(`${block} is interrupted`);
			return engine.interrupt(block);
		},
		items: (place: string) => inPlace(engine, place, values),
		itemsThroughAnotherConnection: (block: string) =>
			Effect.gen(function* () {
				const url = yield* engine.inBlock(
					block,
					Effect.map(PostgresTestDatabase, (database) => database.url),
				);
				const client = yield* PgClient.makeClient({ url });
				return yield* values.pipe(Effect.provideService(SqlClient.SqlClient, client));
			}),
		nestedTransactionFails: (value: string, place: string) => {
			story.tell(`a nested transaction in ${place} writes "${value}" and fails`);
			return inPlace(engine, place, transact(Effect.andThen(writeItem(value), Effect.fail("rejected")), { onSqlError: (error) => error })).pipe(
				Effect.ignore,
			);
		},
		nextId: (place: string) =>
			inPlace(
				engine,
				place,
				Effect.map(nextValue, (id) => `id ${id}`),
			),
		notes: (place: string) => inPlace(engine, place, noteValues),
		openIsolatedBlock: (name: string) => {
			story.tell(`${name} opens its clone`);
			return engine.open(name, "isolated block");
		},
		preparationRuns: () => Effect.sync(() => ({ ...engine.fixture.counts })),
		publishedInvalidations: () => Effect.sync(() => [...engine.published]),
		tables: (place: string) => inPlace(engine, place, tableNames),
		workerDatabases: () =>
			Effect.gen(function* () {
				const remaining = new Set(yield* engine.databaseNames());
				return engine.ownDatabases
					.filter((name) => remaining.has(name))
					.map(roleOf)
					.sort();
			}),
		workerStart: () => Effect.sync(() => engine.start),
		writeItem: (value: string, place: string) => {
			story.tell(`${place} writes the item "${value}"`);
			return inPlace(engine, place, writeItem(value));
		},
		writeNote: (value: string, place: string) => {
			story.tell(`${place} writes the note "${value}"`);
			return inPlace(
				engine,
				place,
				Effect.flatMap(SqlClient.SqlClient, (sql) => sql`insert into notes values (1, ${value})`),
			);
		},
	};
}
