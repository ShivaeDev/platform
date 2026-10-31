import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { briefRefusingFleet } from "#test/workspaceBoardTraits.ts";

const SOURCE = "---\nid: fleet.example\nkind: task\nfleet: approved\n---\n# New brief\n";
const REFUSAL = "id fleet.example was delivered in example/project#7; give this brief a new id";

boardStory.it(
	"Fleet's refusal of a delivered id shows on the brief's id line and leaves its file untouched",
	[projectFiles({ "new.md": SOURCE }), briefRefusingFleet({ "fleet.example": REFUSAL })],
	function* ({ fleetBriefRequests, itemDiagnostics, savedFile }) {
		const diagnostics = yield* itemDiagnostics("/new.md");

		yield* outcomes([
			["brief file", () => savedFile("new.md"), SOURCE],
			["briefs asked about", () => fleetBriefRequests(), [["fleet.example at new.md"]]],
		]);
		expect(diagnostics).toEqual([{ field: "id", line: 2, message: REFUSAL }]);
	},
);

for (const status of ["done", "dropped"]) {
	boardStory.it(
		`a ${status} brief is not checked with Fleet and keeps its retired areas quiet`,
		[
			projectFiles({ "archive/old.md": SOURCE.replace("fleet: approved", `status: ${status}\nareas: [removed-package]`) }),
			briefRefusingFleet({ "fleet.example": REFUSAL }),
		],
		function* ({ fleetBriefRequests, itemDiagnostics }) {
			const diagnostics = yield* itemDiagnostics("/archive/old.md");

			yield* outcomes([["briefs asked about", () => fleetBriefRequests(), []]]);
			expect(diagnostics).toEqual([]);
		},
	);
}

const SHOWN = Array.from({ length: 30 }, (_, index) => `fleet.shown-${index}`);
const fleetItem = { attentionOwner: "automation" as const, stage: "working" as const, stageEnteredAt: 100, updatedAt: 200 };

boardStory.it(
	"the overview checks all thirty shown briefs with Fleet in one request and hides the one Fleet refuses",
	[
		projectFiles({
			...Object.fromEntries(SHOWN.map((id, index) => [`tasks/${index}.md`, `---\nid: ${id}\nkind: task\nstatus: ready\n---\n# Shown ${index}\n`])),
			"tasks/done.md": "---\nid: fleet.delivered\nkind: task\nstatus: done\n---\n# Delivered\n",
		}),
		briefRefusingFleet(
			{ "fleet.shown-0": "id fleet.shown-0 was delivered in example/project#7; give this brief a new id" },
			{
				completed: [{ ...fleetItem, completedAt: 200, stage: "done", workId: "fleet.delivered" }],
				items: SHOWN.map((workId) => ({ ...fleetItem, workId })),
			},
		),
	],
	function* ({ fleetBriefRequests, overviewFleet }) {
		const overview = yield* overviewFleet();

		expect(overview).toEqual({ completed: ["fleet.delivered"], shown: SHOWN.slice(1) });
		expect(yield* fleetBriefRequests()).toEqual([SHOWN.map((id, index) => `${id} at tasks/${index}.md`)]);
	},
);
