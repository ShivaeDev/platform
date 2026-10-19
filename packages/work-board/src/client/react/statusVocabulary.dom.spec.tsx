import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { statusVocabularyFixture } from "#test/statusVocabularyFixture.ts";

expectNoReactWarnings();
const options = { home: "home.md" };
const MERGE = "[data-item='task.merge']";

screenStory.it(
	"places a task whose file says review in Now's Reviewing lane and counts it in the nav",
	[routedScreen(statusVocabularyFixture(), "/_board/work", options)],
	function* ({ findElement, readAttribute, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement(`[aria-label='Reviewing'] ${MERGE}`)).not.toBeNull()));
		expect(readText(`${MERGE} [data-status-token]`)).toBe("In progress");
		expect(findElement("[data-item='task.odd']")).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(readAttribute("a[href='/_board/work']", "aria-label")).toBe("Now, 2 open tasks")));
	},
);

screenStory.it(
	"queues Fleet-approved ready work while Fleet is unavailable",
	[routedScreen(statusVocabularyFixture(), "/_board/work", options)],
	function* ({ findElement }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[aria-label='Queued'] [data-item='task.ready']")).not.toBeNull()));
	},
);

screenStory.it(
	"counts a task whose file says review as in progress on Today and reports an unknown status",
	[routedScreen(statusVocabularyFixture(), "/", options)],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-progress-id='task.merge']")).not.toBeNull()));
		expect(readText("[data-progress-id='task.merge']")).toBe("Merge the release branchTask file");
		expect(findElement("[data-progress-id='task.odd']")).toBeNull();
		yield* Effect.promise(() =>
			eventually(() => expect(readText(".today-strip")).toBe("0 need you·1 in progress in task files·1 active goal·1 file has problems")),
		);
	},
);

screenStory.it(
	"groups review work as in progress and ready work and an unknown status as planned on the goal page",
	[routedScreen(statusVocabularyFixture(), "/_board/item/goal.ship/", options)],
	function* ({ findElement, readText }) {
		yield* Effect.promise(() =>
			eventually(() => expect(findElement("[data-goal-group='In progress'] [data-goal-item='task.merge']")).not.toBeNull()),
		);
		expect(readText("[data-goal-item='task.merge'] [data-status-token]")).toBe("In review");
		expect(findElement("[data-goal-group='Planned'] [data-goal-item='task.odd']")).not.toBeNull();
		expect(readText("[data-goal-item='task.odd'] [data-status-token]")).toBe("Wip");
		expect(findElement("[data-goal-group='Planned'] [data-goal-item='task.ready']")).not.toBeNull();
	},
);

screenStory.it(
	"lists a work file with an unknown status among System's files with problems",
	[routedScreen(statusVocabularyFixture(), "/_board/system", options)],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("[data-source-problem='tasks/odd.md']")).not.toBeNull()));
		expect(readText("[data-source-problem='tasks/odd.md']")).toBe(
			"tasks/odd.md Line 4Unknown status wip. Now leaves this work out and goal pages count it as planned.",
		);
		expect(findElements("[data-source-problem]").map((problem) => problem.getAttribute("data-source-problem"))).toEqual(["tasks/odd.md"]);
	},
);
