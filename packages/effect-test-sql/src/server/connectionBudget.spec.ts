import { database } from "#test/database.ts";
import { databasesUnderPressure, markedSessions, poolLimit } from "#test/databaseTraits.ts";

for (const maxConnections of [undefined, 3]) {
	database.it(
		`12 concurrent databases use at most ${maxConnections ?? 2} connections each, with no idle administration sessions`,
		[databasesUnderPressure(12), markedSessions, ...(maxConnections === undefined ? [] : [poolLimit(maxConnections)])],
		function* ({ connectionBudgetIsRespected }) {
			yield* connectionBudgetIsRespected();
		},
	);
}
