import { Effect, Queue, Schema } from "effect";
import { Model } from "effect/schema";
import { expect } from "vitest";
import { migrationChanges } from "#test/app-host/migrationChanges.ts";

class SeedRow extends Model.Class<SeedRow>("SeedRow")({ id: Schema.Number }) {}

migrationChanges.it(
	"default startup migrations notify an independent PostgreSQL listener after commit",
	[],
	function* ({ listen, makeRepository, migrate, sql, table }) {
		const notifications = yield* listen();
		const tableName = table();
		const migration = Effect.gen(function* () {
			const client = yield* sql;
			yield* client`create table ${client(tableName)} (id integer primary key)`;
			const rows = yield* makeRepository(SeedRow, { idColumn: "id", spanPrefix: "Seeds", tableName });
			yield* rows.insert({ id: 1 });
			expect(yield* Queue.size(notifications)).toBe(0);
		});
		yield* migrate(migration);
		const notification = yield* Queue.take(notifications).pipe(Effect.timeout("2 seconds"));
		expect(JSON.parse(notification.payload)).toEqual([tableName, `${tableName}:1`]);
		const client = yield* sql;
		expect(yield* client`select id from ${client(tableName)}`).toEqual([{ id: 1 }]);
	},
);
