import { Effect } from "effect";
import { expect } from "vitest";
import { onSqlError } from "#test/postgresTransact.ts";
import { hasCompositeLedger } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"repository writes to a composite key with a bigint column announce its decimal item key after each commit",
	[hasCompositeLedger()],
	function* ({ compositeLedger, transact, watchChanges }) {
		const { entries, tableName } = compositeLedger();
		const sequence = 9_007_199_254_740_993n;
		const key = `${tableName}:["cash","${sequence}"]`;
		const changed = yield* watchChanges([key]);

		const row = yield* Effect.gen(function* () {
			const inserted = yield* entries.insert({ account: "cash", amount: "7", sequence });
			expect(changed).toEqual([]);
			return inserted;
		}).pipe(transact({ onSqlError }));
		expect(row.sequence).toBe(sequence);
		expect(changed).toEqual([key]);

		yield* entries.update({ ...row, amount: "8" });
		expect(changed).toEqual([key, key]);

		yield* entries.delete({ account: "cash", sequence });
		expect(changed).toEqual([key, key, key]);
	},
);
