import { describe, expect, it } from "vitest";
import { knipFindings } from "#knip/findings.ts";

const issues = [
	{ file: "src/unshipped.ts", files: [{ name: "src/unshipped.ts" }] },
	{ exports: [{ line: 1, name: "abandonedExport" }], file: "src/launch.ts" },
	{ file: "script/notes.ts", files: [{ name: "script/notes.ts" }] },
];

function subjects(reported: typeof issues) {
	return knipFindings(JSON.stringify({ issues: reported })).map(({ file, subject }) => ({ file, subject }));
}

describe("knipFindings", () => {
	it("lists the same findings in the same order whichever order knip reports the files in", () => {
		expect(subjects(issues)).toEqual(subjects(issues.toReversed()));
		expect(subjects(issues)).toEqual([
			{ file: "script/notes.ts", subject: "files:script/notes.ts" },
			{ file: "src/launch.ts", subject: "exports:abandonedExport" },
			{ file: "src/unshipped.ts", subject: "files:src/unshipped.ts" },
		]);
	});
});
