import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
import { Pot } from "#test/diary/Pot.ts";
import { PotStorage } from "#test/diary/PotStorage.ts";
import { ownTable } from "#test/writeTables.ts";

export const initializePots = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const { tableName, initialized } = yield* PotStorage;
	yield* ownTable(sql, tableName, sql`id integer primary key, amount integer not null, pending integer not null`);
	const rows = yield* makeRepository(Pot, { idColumn: "id", spanPrefix: "Pots", tableName });
	const load = Effect.fn("Pots.load")((id: number) => rows.findById(id));
	const settle = Effect.fn("Pots.settle")(function* (id: number) {
		const pot = yield* load(id);
		return yield* rows.update({ ...pot, amount: pot.amount + pot.pending, pending: 0 });
	});
	const pots = { load, rows, settle };
	initialized.push(pots);
	return pots;
});
