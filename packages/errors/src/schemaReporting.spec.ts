import { expect } from "vitest";
import { schemaReporting } from "#test/schemaReporting.ts";

for (const kind of ["failure", "defect"] as const) {
	schemaReporting.it(
		`a schema ${kind} reaches the reporter with paths and expectations and without alice's text`,
		[],
		function* ({ recordedReports, submitAges }) {
			yield* submitAges(['alice private note "quoted"\\trail\nconfidential second line', { note: "alice other private note" }], kind);

			const reports = yield* recordedReports();
			expect(reports).toEqual([
				expect.objectContaining({
					message: 'Expected number, got <redacted>\n  at ["profile"]["ages"][0]\nExpected number, got <redacted>\n  at ["profile"]["ages"][1]',
				}),
			]);
			expect(JSON.stringify(reports)).not.toMatch(/alice private note|confidential second line|alice other private note/u);
		},
	);
}
