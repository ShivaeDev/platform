import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { areaRepository } from "#test/areaRepository.ts";
import { boardStory } from "#test/boardStory.ts";
import { fleetAcceptsEveryBrief } from "#test/workspaceBoardTraits.ts";

const AREAS = ["react", "work-fleet/scheduling", "jobs/server", "script/release", ".github", "*"];

boardStory.it(
	"a brief may name existing packages, their subfolders, top-level folders and every area",
	[areaRepository(AREAS), fleetAcceptsEveryBrief],
	function* ({ itemDiagnostics, itemMetadata }) {
		yield* outcomes({
			areas: [itemMetadata("/task.md"), expect.objectContaining({ areas: AREAS })],
			problems: [itemDiagnostics("/task.md"), []],
		});
	},
);

for (const [area, suggestion] of [
	["work-fleet/schedulng", "work-fleet/scheduling"],
	["effect-react", "react"],
] as const) {
	boardStory.it(
		`an area ${area} that names no folder is a problem suggesting ${suggestion}`,
		[areaRepository([area]), fleetAcceptsEveryBrief],
		function* ({ itemDiagnostics }) {
			expect(yield* itemDiagnostics("/task.md")).toEqual([
				{ field: "areas", line: 4, message: `Area "${area}" does not name an existing repository folder. Did you mean "${suggestion}"?` },
			]);
		},
	);
}

for (const status of ["done", "dropped"]) {
	boardStory.it(
		`marking a brief ${status} clears the problem of its renamed area`,
		[areaRepository(["effect-react"]), fleetAcceptsEveryBrief],
		function* ({ editFile, itemDiagnostics }) {
			expect(yield* itemDiagnostics("/task.md")).toEqual([expect.objectContaining({ field: "areas" })]);

			editFile("task.md", `---\nid: task\nkind: task\nstatus: ${status}\nareas: [effect-react]\n---\n# Work`);

			expect(yield* itemDiagnostics("/task.md")).toEqual([]);
		},
	);
}
