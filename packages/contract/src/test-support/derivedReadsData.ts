import { Config, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator, SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { lists, records, TimelineData, Unavailable } from "./derivedReadsContract.ts";

export const derivedDatabase = Layer.unwrap(
	Effect.map(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL"), (url) =>
		makePostgresTestLayer({
			migrations: {
				loader: Migrator.fromRecord({
					"1_timelines": Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql`create table lists (id integer primary key, scope text not null)`;
						yield* sql`create table records (id integer primary key, list_id integer not null references lists, body text not null)`;
						yield* sql`insert into lists values (1, 'alice'), (2, 'alice'), (3, 'bob')`;
						yield* sql`insert into records values (1, 1, 'First'), (2, 2, 'Second'), (3, 3, 'Private')`;
					}),
				}),
				lockTimeout: "5 seconds",
			},
			url,
		}),
	),
);

export const derivedReadsData = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.Reactivity;
	const data = Layer.succeed(TimelineData, {
		keys: (scope) =>
			sql<{ id: number }>`select id from lists where scope = ${scope}`.pipe(
				Effect.map((rows) => rows.map(({ id }) => records.bucket.listId(id))),
				Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
			),
		load: (scope) =>
			sql<{ body: string }>`select r.body from records r join lists l on r.list_id = l.id where l.scope = ${scope} order by r.id`.pipe(
				Effect.map((rows) => rows.map(({ body }) => body)),
				Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())),
			),
	});
	const create = Effect.fnUntraced(function* ({ id, scope, body }: { id: number; scope: string; body: string }) {
		yield* sql
			.withTransaction(
				Effect.gen(function* () {
					yield* sql`insert into lists values (${id}, ${scope})`;
					yield* sql`insert into records values (${id}, ${id}, ${body})`;
				}),
			)
			.pipe(Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())));
		yield* reactivity.invalidate(invalidationKeys([lists.bucket.scope(scope)]));
	});
	const edit = Effect.fnUntraced(function* ({ id, body }: { id: number; body: string }) {
		const rows = yield* sql
			.withTransaction(
				sql<{
					"list_id": number;
				}>`update records set body = ${body} where id = ${id} returning list_id`,
			)
			.pipe(Effect.catchTag("SqlError", () => Effect.fail(new Unavailable())));
		const row = rows[0];
		if (row === undefined) {
			return yield* new Unavailable();
		}
		yield* reactivity.invalidate(invalidationKeys([records.item(id), records.bucket.listId(row.list_id)]));
		return row.list_id;
	});
	return { create, data, edit };
});
