import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";
import { TodayProgress } from "./TodayProgress.tsx";

screenStory.it(
	"Today lists the first eight pieces of Fleet-held work by title with a Fleet badge, its pull request and a link to Now",
	[componentScreen(<TodayProgress data={todayFleetFixture()} failed={false} />)],
	function* ({ inProgressList }) {
		expect(yield* inProgressList()).toEqual(
			expect.objectContaining({
				now: "All in Now →",
				rows: [
					{ badge: "Fleet", id: "task.sample.0", pr: "https://github.com/example/project/pull/1", title: "Workspace task 0" },
					...Array.from({ length: 7 }, (_, index) => expect.objectContaining({ badge: "Fleet", id: `task.sample.${index + 1}` })),
				],
			}),
		);
	},
);

const UNANSWERED = "Fleet on port 3457 didn't answer as expected, so agent work and its health are unknown.";
for (const [data, status] of [
	[undefined, "Fleet work unavailable."],
	[{ reason: UNANSWERED, state: "unavailable" }, UNANSWERED],
] as const) {
	screenStory.it(
		`Today says why Fleet work is unavailable instead of showing an empty list: ${status}`,
		[componentScreen(<TodayProgress data={data} failed />)],
		function* ({ inProgressList }) {
			expect(yield* inProgressList()).toEqual(expect.objectContaining({ empty: "none", rows: [], status: [status] }));
		},
	);
}

const data = todayFleetFixture();
if (data.state !== "ready" || !data.items[0]) {
	throw new Error("Missing held work");
}
const { prUrl, ...item } = data.items[0];
screenStory.it(
	"Today keeps held work without a source file or pull request listed by id and says its refresh failed",
	[componentScreen(<TodayProgress data={{ ...data, items: [{ ...item, document: null }] }} failed />)],
	function* ({ inProgressList }) {
		expect(yield* inProgressList()).toEqual(
			expect.objectContaining({
				rows: [{ badge: "Fleet", id: "task.sample.0", pr: "none", title: "task.sample.0" }],
				status: ["Fleet refresh failed. Displayed work is retained."],
			}),
		);
	},
);

for (const [name, progress, expected] of [
	["still loading", undefined, { empty: "none", loading: "Loading work in progress with skeleton rows" }],
	["empty", { completed: [], items: [], state: "ready" as const }, { empty: "No work in progress", loading: "none" }],
] as const) {
	screenStory.it(
		`Today tells Fleet work that is ${name} apart from the other state`,
		[componentScreen(<TodayProgress data={progress} failed={false} />)],
		function* ({ inProgressList }) {
			expect(yield* inProgressList()).toEqual(expect.objectContaining({ ...expected, now: "All in Now →" }));
		},
	);
}
