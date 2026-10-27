import { expect } from "vitest";
import { database } from "#test/database.ts";
import { databasesUnderPressure, markedSessions, poolLimit } from "#test/databaseTraits.ts";

for (const maxConnections of [undefined, 3]) {
	database.it(
		`12 concurrent databases use at most ${maxConnections ?? 2} connections each, with no idle administration sessions`,
		[databasesUnderPressure(12), markedSessions, ...(maxConnections === undefined ? [] : [poolLimit(maxConnections)])],
		function* ({ awaitPressure, readSessions, releasePressure, joinClones, closeWorker, awaitClosedSessions }) {
			yield* awaitPressure();
			expect(yield* readSessions()).toEqual([{ count: 12 * (maxConnections ?? 2) }]);
			yield* releasePressure();
			expect(yield* joinClones()).toHaveLength(12 * 6);
			yield* closeWorker();
			expect(yield* awaitClosedSessions()).toEqual([{ count: 0 }]);
		},
	);
}
