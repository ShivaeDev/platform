import { expect } from "vitest";
import { filesStory, reportFile, snapshotFile } from "#test/fileKit.ts";

for (const format of ["truncated", "older", "invalid task", "invalid history", "invalid flaky test"] as const) {
	filesStory.it(`a ${format} snapshot fails with a typed error naming the file`, [snapshotFile(format)], function* ({ readSnapshot }) {
		const failure = yield* readSnapshot();

		expect(failure).toEqual({ error: "VitestRerunError", message: expect.stringMatching(/^Could not decode snapshot .*\/attempt\.snapshot$/u) });
	});
}

for (const contents of ['{"testResults":', "{}", '{"testResults":[{"name":42}]}', '{"testResults":[]}']) {
	filesStory.it(
		`a malformed timed report (${contents}) fails with a typed error naming the file`,
		[reportFile(contents)],
		function* ({ timeReport }) {
			const failure = yield* timeReport();

			expect(failure).toEqual({ error: "VitestRerunError", message: expect.stringMatching(/^Could not decode timed report .*\/tests\.json$/u) });
		},
	);
}

filesStory.it(
	"timing a report adds the duration and preserves Vitest's other fields",
	[
		reportFile(
			'{"success":true,"coverageMap":{"file":{}},"testResults":[{"name":"test.spec.ts","status":"passed","assertionResults":[],"startTime":10}]}',
		),
	],
	function* ({ report, timeReport }) {
		yield* timeReport();

		expect(yield* report()).toEqual({
			coverageMap: { file: {} },
			success: true,
			testResults: [{ assertionResults: [], durationMs: 42, name: "test.spec.ts", startTime: 10, status: "passed" }],
		});
	},
);
