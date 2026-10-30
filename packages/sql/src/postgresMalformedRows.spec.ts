import { expect } from "vitest";
import { malformedLedger, malformedRelease, storedMigrationRows } from "#test/storedMigrationRows.ts";

for (const action of ["migrate", "checkReadiness"] as const) {
	storedMigrationRows.it(`${action} refuses a ledger row whose migration id is not a number`, [malformedLedger()], function* (verbs) {
		const outcome = yield* verbs[action]();

		expect(outcome).toBe("refused the stored row");
	});
}

for (const action of ["readRelease", "checkReleaseReadiness"] as const) {
	for (const column of ["release", "recorded_at"] as const) {
		storedMigrationRows.it(`${action} refuses a release marker with an invalid ${column}`, [malformedRelease(column)], function* (verbs) {
			const outcome = yield* verbs[action]();

			expect(outcome).toBe("refused the stored row");
		});
	}
}

storedMigrationRows.it(
	"claiming a release refuses a release marker whose owner is not text",
	[malformedRelease("release")],
	function* ({ claimRelease }) {
		const outcome = yield* claimRelease();

		expect(outcome).toBe("refused the stored row");
	},
);
