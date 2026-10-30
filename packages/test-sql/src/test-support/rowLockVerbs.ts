import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { raceWithLock } from "#raceWithLock.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { values } from "./postgres.ts";

const contendForRow = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const results = yield* raceWithLock({
		effects: [
			withTestTransaction(
				Effect.gen(function* () {
					const before = yield* values;
					yield* sql`update items set value = 'second' where id = 1`;
					return { after: yield* values, before };
				}),
			),
		],
		lock: sql`update items set value = 'first' where id = 1`,
	});
	return { attempts: yield* Effect.forEach(results, Effect.fromResult), rolledBack: yield* values };
});

export function rowLockVerbs(engine: DatabaseEngine) {
	return {
		contendForRow: () => engine.run(contendForRow),
	};
}
