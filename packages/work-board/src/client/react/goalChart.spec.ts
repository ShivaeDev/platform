import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { waitFor } from "#test/live.ts";

const goalChart = /^\/_board\/react-assets\/GoalChart-[\w-]+\.js$/u;

boardStory.it(
	"loads the goal chart only on a goal page that charts its criteria",
	[projectFiles(goalPageFixture()), readerAt("/")],
	function* ({ reader, page: today }) {
		yield* Effect.promise(() => waitFor(() => expect(today.document.querySelector("#doc h1")?.textContent).toBe("Today")));
		expect(today.chunkRequests.filter((chunk) => goalChart.test(chunk))).toEqual([]);
		const goal = yield* reader.open("/goal.md");
		yield* Effect.promise(() =>
			waitFor(() => expect(goal.chunkRequests.filter((chunk) => goalChart.test(chunk))).toEqual([expect.stringMatching(goalChart)])),
		);
	},
);
