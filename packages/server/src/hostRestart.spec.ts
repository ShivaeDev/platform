import { expect } from "vitest";
import { restartStory } from "#test/restart/story.ts";

const bothQueriesInEveryTab = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`tab ${index + 1}`, [1, 2]]));

restartStory.it(
	"after the host restarts, each of twelve live tabs reruns both mounted queries on the replacement host",
	[],
	function* ({ queriesAnsweredByCurrentHost, restart }) {
		expect(yield* queriesAnsweredByCurrentHost()).toEqual(bothQueriesInEveryTab);

		yield* restart();

		expect(yield* queriesAnsweredByCurrentHost()).toEqual(bothQueriesInEveryTab);
	},
);

restartStory.it("after the host restarts, the twelve tabs' first reruns spread over more than 50 ms", [], function* ({ restart, rerunSpread }) {
	yield* restart();

	expect(yield* rerunSpread()).toBe("spread over more than 50 ms");
});
