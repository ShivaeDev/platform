import { describe, expect, it } from "vitest";
import { distinctCase } from "#rules/files/distinctCase.ts";
import { checkRule, issuesOf } from "#test/inputs.ts";

function findingsFor(files: readonly string[]) {
	return checkRule(distinctCase, undefined, { files });
}

describe("files/distinct-case", () => {
	it("flags a component and a topic module that build to the same file on a case-insensitive filesystem", async () => {
		const findings = await findingsFor(["src/react/ReadingHistory.tsx", "src/react/readingHistory.ts", "src/react/ReadingPanel.tsx"]);
		expect(findings).toEqual([
			{
				file: "src/react/ReadingHistory.tsx",
				message:
					'"ReadingHistory.tsx" and "readingHistory.ts" differ only by case, in their names or in the files they build to, so they are one path on a case-insensitive filesystem such as macOS or Windows. Rename one of them.',
			},
			{
				file: "src/react/readingHistory.ts",
				message:
					'"readingHistory.ts" and "ReadingHistory.tsx" differ only by case, in their names or in the files they build to, so they are one path on a case-insensitive filesystem such as macOS or Windows. Rename one of them.',
			},
		]);
	});

	it("flags files that are not code and differ only by case", async () => {
		const findings = await findingsFor(["docs/README.md", "docs/readme.md"]);
		expect(findings.map((finding) => finding.file)).toEqual(["docs/README.md", "docs/readme.md"]);
	});

	it("flags folders that differ only by case once, without the files inside them", async () => {
		const findings = await findingsFor(["src/Dialog/parts.ts", "src/dialog/parts.ts", "src/dialog/Dialog/index.ts"]);
		expect(findings.map((finding) => finding.file)).toEqual(["src/Dialog", "src/dialog"]);
	});

	it("passes names that differ by more than case and outputs that stay distinct", async () => {
		const findings = await findingsFor([
			"src/Panel/Panel.tsx",
			"src/panel.css",
			"src/Item.tsx",
			"src/ItemList.tsx",
			"src/Worker.mts",
			"src/worker.ts",
			"src/legacy.js",
			"src/legacy.ts",
			"lib/Item.tsx",
		]);
		expect(findings).toEqual([]);
	});

	it("takes no options", async () => {
		expect(await issuesOf(distinctCase, {})).not.toEqual([]);
	});
});
