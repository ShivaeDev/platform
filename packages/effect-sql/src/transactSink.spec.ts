import { Effect } from "effect";
import { expect } from "vitest";
import { onSqlError } from "#test/postgresTransact.ts";
import { sqlite } from "#test/sqlStory.ts";
import { hasSqliteTransactions, subscriberThrows } from "#test/sqlTraits.ts";

sqlite.it(
	"a failing invalidation after commit is logged and the committed result stands",
	[hasSqliteTransactions(), subscriberThrows("orders")],
	function* ({ sql, sqliteTransactions, transact, invalidateOnCommit, recordedLogs }) {
		const { insert } = sqliteTransactions();
		const saved = yield* Effect.as(Effect.andThen(insert(1), invalidateOnCommit({ orders: [1] })), "saved").pipe(transact({ onSqlError }));
		yield* invalidateOnCommit(["orders"]);
		expect(saved).toBe("saved");
		expect(yield* sql`select id from orders`).toEqual([{ id: 1 }]);
		const failure = { cause: expect.stringContaining("subscriber threw"), level: "Error", message: [expect.stringContaining("committed")] };
		expect(recordedLogs()).toEqual([failure, failure]);
	},
);
