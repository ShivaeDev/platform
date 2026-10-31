import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { DUPLICATE_CRITERION_SOURCE } from "#test/coverageEdges.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

boardStory.it(
	"a duplicated criterion identity is reported on the item, and search links to neither claim",
	[projectFiles({ "item.md": DUPLICATE_CRITERION_SOURCE }), fleetAcceptsEveryBrief],
	function* ({ criterionLinks, documentDiagnostics }) {
		yield* outcomes([
			["criterion links in search", () => criterionLinks("criterion"), []],
			[
				"item diagnostics",
				() => documentDiagnostics("item.md"),
				[
					expect.objectContaining({ line: 4, message: "Duplicate criterion ID duplicate." }),
					expect.objectContaining({ line: 6, message: "Duplicate criterion ID duplicate." }),
				],
			],
		]);
	},
);

const PASSAGE = `${"Before ".repeat(30)}needle${" after".repeat(40)}`;

boardStory.it(
	"a long matching passage shows ellipses for its omitted ends and still links to its note",
	[projectFiles({ "note.md": `# Context\n\n${PASSAGE}\n` })],
	function* ({ firstResult }) {
		expect(yield* firstResult("needle")).toMatchObject({
			href: "/note.md",
			snippet: `…${PASSAGE.slice(PASSAGE.indexOf("needle") - 50, PASSAGE.indexOf("needle") + 130)}…`,
		});
	},
);
