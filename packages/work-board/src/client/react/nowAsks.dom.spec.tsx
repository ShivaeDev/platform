import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nowAsksFixture } from "#test/nowAsksFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"Now puts a task with an open ask for the reader in Waiting on you and leaves agent asks and related questions queued",
	[routedScreen(nowAsksFixture, "/_board/work", { home: "home.md" })],
	function* ({ nowCard, nowLane }) {
		yield* outcomes({
			queued: [nowLane("Queued"), expect.objectContaining({ cards: expect.arrayContaining(["task.agent", "task.related"]), count: "2" })],
			yours: [nowCard("task.yours"), expect.objectContaining({ lane: "Waiting on you", owner: "Waiting on your answer", states: ["Needs you"] })],
		});
	},
);

for (const [task, chip] of [
	["task.yours", "Needs you"],
	["task.agent", "Waiting on automation"],
] as const) {
	screenStory.it(
		`The item page of ${task} says who answers its open ask, like Now and Today`,
		[routedScreen(nowAsksFixture, `/_board/item/${task}/`, { home: "home.md" })],
		function* ({ itemStatus }) {
			expect(yield* itemStatus()).toBe(chip);
		},
	);
}
