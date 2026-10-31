import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { statusVocabularyFixture } from "#test/statusVocabularyFixture.ts";

expectNoReactWarnings();

for (const [files, label] of [
	[statusVocabularyFixture(), "Now, 2 open tasks"],
	[(({ "tasks/ready.md": _ready, ...others }) => others)(statusVocabularyFixture()), "Now, 1 open task"],
] as const) {
	screenStory.it(
		`Now shows a ready brief in Queued, leaves out an invalid status and names "${label}" in navigation`,
		[routedScreen(files, "/_board/work")],
		function* ({ navigationLabels, nowCard, workItems }) {
			yield* outcomes([
				["navigation", () => navigationLabels(), expect.arrayContaining([label])],
				["the ready brief", () => nowCard("task.merge"), expect.objectContaining({ lane: "Queued", states: ["Ready"] })],
				["work shown", () => workItems(), expect.not.arrayContaining(["task.odd"])],
			]);
		},
	);
}

screenStory.it(
	"System names an invalid authored status and the migration command",
	[routedScreen(statusVocabularyFixture(), "/_board/system")],
	function* ({ sourceProblemList }) {
		expect(yield* sourceProblemList()).toEqual([
			expect.objectContaining({ file: "tasks/odd.md", reason: expect.stringContaining("Invalid status; run work-board migrate <board dir>.") }),
		]);
	},
);
