import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { goalDocumentScreen } from "#test/goalTraits.tsx";
import { screenChartLayout } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

const files = { ...goalPageFixture(), "asks.md": "# No open asks" };

screenStory.it(
	"the goal chart labels each criterion by its text and links the label to that criterion",
	[screenChartLayout(), goalDocumentScreen(files)],
	function* ({ criterionChartLabels }) {
		expect(yield* criterionChartLabels()).toEqual([
			{ leadsTo: "First criterion", link: "#criterion-first", text: "First criterion" },
			{ leadsTo: "Second criterion", link: "#criterion-second", text: "Second criterion" },
		]);
	},
);

const extraDone = Object.fromEntries(
	Array.from({ length: 100 }, (_, index) => [
		`extra-${index}.md`,
		`---\nid: task.extra-${index}\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Extra ${index}`,
	]),
);

for (const { counts, name, workspace } of [
	{ counts: ["2", "No linked work"], name: "writes each count on its bar segment and says when a criterion has no linked work", workspace: files },
	{ counts: ["100", "No linked work"], name: "leaves a count off a bar segment too narrow to hold it", workspace: { ...files, ...extraDone } },
]) {
	screenStory.it(`the goal chart ${name}`, [screenChartLayout(), goalDocumentScreen(workspace)], function* ({ criterionChartCounts }) {
		expect(yield* criterionChartCounts()).toEqual(counts);
	});
}

screenStory.it(
	"a goal page leaves the chart out when no criterion has linked work, and still counts the goal's work",
	[
		screenChartLayout(),
		goalDocumentScreen(
			Object.fromEntries(
				Object.entries(files).map(([file, source]) => [file, source.replaceAll("target: project.example#first", "target: project.example")]),
			),
		),
	],
	function* ({ goalChart, goalPageStateCounts }) {
		yield* outcomes({
			chart: [goalChart(), { state: "absent" }],
			"linked work by state": [goalPageStateCounts(), ["1 done", "0 running (quiet)", "0 blocked (quiet)", "0 scheduled (quiet)", "4 parked"]],
		});
	},
);

const DROPPED_TASK =
	"---\nid: task.dropped\nkind: task\nstatus: dropped\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Dropped task";
const READY_TASK =
	"---\nid: task.ready\nkind: task\nstatus: ready\nrelationships:\n - kind: implements\n   target: project.example\n---\n# Ready task";

for (const [id, group] of [
	["task.dropped", "Dropped"],
	["task.ready", "Ready"],
] as const) {
	screenStory.it(
		`${group.toLowerCase()} linked work gets a ${group} group of its own whose rows link to the work`,
		[goalDocumentScreen({ ...files, "dropped.md": DROPPED_TASK, "ready.md": READY_TASK })],
		function* ({ linkedWorkRow }) {
			expect(yield* linkedWorkRow(id)).toEqual(expect.objectContaining({ group, link: `/_board/item/${id}/`, states: [group] }));
		},
	);
}

screenStory.it(
	"a linked work group shows only the columns its rows use",
	[goalDocumentScreen({ ...files, "dropped.md": DROPPED_TASK, "ready.md": READY_TASK })],
	function* ({ linkedWorkColumns }) {
		yield* outcomes({
			draft: [linkedWorkColumns("Draft"), ["Work", "Criteria", "State"]],
			ready: [linkedWorkColumns("Ready"), ["Work", "State", "Owner", "Updated"]],
		});
	},
);
