import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { inPlace } from "./inPlace.ts";

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

export function databaseQueries(engine: DatabaseEngine, story: Story<DatabaseEngine>) {
	return {
		appliedMigrations: (place: string) => {
			story.tell(`the story reads the applied migrations in ${place}`);
			return inPlace(engine, place, ledger);
		},
		items: (place: string) => {
			story.tell(`the story reads the items in ${place}`);
			return inPlace(engine, place, values);
		},
		itemsThroughAnotherConnection: (block: string) => {
			story.tell(`another connection reads the items in ${block}`);
			return Effect.gen(function* () {
				const url = yield* engine.inBlock(
					block,
					Effect.map(PostgresTestDatabase, (database) => database.url),
				);
				const client = yield* PgClient.makeClient({ url });
				return yield* values.pipe(Effect.provideService(SqlClient.SqlClient, client));
			});
		},
		nextId: (place: string) => {
			story.tell(`the story takes the next sequence id in ${place}`);
			return inPlace(
				engine,
				place,
				Effect.map(nextValue, (id) => `id ${id}`),
			);
		},
		notes: (place: string) => {
			story.tell(`the story reads the notes in ${place}`);
			return inPlace(engine, place, noteValues);
		},
		tables: (place: string) => {
			story.tell(`the story reads the tables in ${place}`);
			return inPlace(engine, place, tableNames);
		},
	};
}
