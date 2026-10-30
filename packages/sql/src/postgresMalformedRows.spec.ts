import { expect } from "vitest";
import { malformedLedger, malformedRelease, migrationReads } from "#test/migrationReadStory.ts";

for (const action of ["migrate", "checkReadiness"] as const) {
	migrationReads.it(`${action} fails with SchemaError for a malformed ledger row`, [malformedLedger()], function* (verbs) {
		expect(yield* verbs[action]()).toBe("invalid stored row");
	});
}

for (const action of ["readRelease", "checkReleaseReadiness"] as const) {
	for (const column of ["release", "recorded_at"] as const) {
		migrationReads.it(`${action} fails with SchemaError for a malformed ${column}`, [malformedRelease(column)], function* (verbs) {
			expect(yield* verbs[action]()).toBe("invalid stored row");
		});
	}
}

migrationReads.it("claiming a release fails with SchemaError for a malformed owner", [malformedRelease("release")], function* ({ claimRelease }) {
	expect(yield* claimRelease()).toBe("invalid stored row");
});
