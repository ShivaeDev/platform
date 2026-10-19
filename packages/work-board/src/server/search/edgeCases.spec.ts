import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { DUPLICATE_CRITERION_SOURCE } from "#test/coverageEdges.ts";

boardStory.it(
	"omits duplicated criterion identities instead of linking to an arbitrary claim",
	[projectFiles({ "item.md": DUPLICATE_CRITERION_SOURCE })],
	function* ({ search, readDocument }) {
		expect((yield* search("criterion")).results.filter((entry) => entry.href.includes("#criterion-"))).toEqual([]);
		expect((yield* readDocument("item.md")).diagnostics.some((problem) => problem.message.includes("Duplicate criterion"))).toBe(true);
	},
);

const text = `${"Before ".repeat(30)}needle${" after".repeat(40)}`;
boardStory.it(
	"discloses omitted ends of a matching passage without changing its destination",
	[projectFiles({ "note.md": `# Context\n\n${text}\n` })],
	function* ({ search }) {
		const result = (yield* search("needle")).results[0];
		expect(result?.snippet).toBe(`…${text.slice(text.indexOf("needle") - 50, text.indexOf("needle") + 130)}…`);
		expect(result?.href).toBe("/note.md");
	},
);
