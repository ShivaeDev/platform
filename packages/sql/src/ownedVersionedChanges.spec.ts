import { Effect, Result } from "effect";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasOwnedRows } from "#test/sqlTraits.ts";

postgres.it(
	"composite versioned writes roll back with transact and discard their changes",
	[hasOwnedRows()],
	function* ({ ownedRows, transact, watchChanges }) {
		const { rows, tableName } = ownedRows();
		const original = yield* rows.insert({ id: 1, name: "Draft", ownerId: 2 });
		const changes = yield* watchChanges([tableName, `${tableName}:["1","2"]`, `${tableName}:["3","2"]`]);
		const outcome = yield* Effect.gen(function* () {
			yield* rows.update({ ...original, name: "Published" });
			yield* rows.updateVoid({ ...original, lockVersion: 1, name: "Final" });
			yield* rows.delete(original, 2);
			yield* rows.insertVoid({ id: 3, name: "Temporary", ownerId: 2 });
			yield* rows.insertOrIgnore({ id: 4, name: "Temporary", ownerId: 2 });
			expect(changes).toEqual([]);
			return yield* Effect.fail("cancelled");
		}).pipe(transact({ onSqlError: (error) => error }), Effect.result);
		expect(outcome).toEqual(Result.fail("cancelled"));
		expect(yield* rows.findMany()).toEqual([original]);
		expect(changes).toEqual([]);
	},
);

postgres.it(
	"each composite versioned write announces all encoded key columns only after commit",
	[hasOwnedRows()],
	function* ({ ownedRows, transact, watchChanges }) {
		const { rows, tableName } = ownedRows();
		const item = `${tableName}:["1","2"]`;
		const changes = yield* watchChanges([tableName, item]);
		yield* Effect.gen(function* () {
			yield* rows.insertVoid({ id: 1, name: "Draft", ownerId: 2 });
			expect(changes).toEqual([]);
		}).pipe(transact({ onSqlError: (error) => error }));
		expect(changes).toEqual([tableName, item]);
		const original = yield* rows.findById({ id: 1, ownerId: 2 });
		yield* Effect.gen(function* () {
			yield* rows.update({ ...original, name: "Published" });
			expect(changes).toEqual([tableName, item]);
		}).pipe(transact({ onSqlError: (error) => error }));
		yield* rows.updateVoid({ ...original, lockVersion: 1, name: "Final" });
		yield* rows.delete(original, 2);
		yield* rows.insertOrIgnore({ id: 1, name: "Recreated", ownerId: 2 });
		expect(changes).toEqual(Array.from({ length: 5 }, () => [tableName, item]).flat());
		yield* rows.insertOrIgnore({ id: 1, name: "Ignored", ownerId: 1 });
		yield* rows.update({ ...original, ownerId: 1 }).pipe(Effect.ignore);
		expect(changes).toEqual(Array.from({ length: 5 }, () => [tableName, item]).flat());
	},
);
