import { expect } from "vitest";
import { restartStory } from "#test/restart/story.ts";

restartStory.it(
	"twelve live tabs resubscribe and rerun both mounted queries on the replacement host with reruns spread over time",
	[],
	function* ({ processId, results, restart }) {
		const original = processId();
		const before = yield* results();
		expect(before.map((tab) => tab.map((result) => result.pid))).toEqual(Array.from({ length: 12 }, () => [original, original]));

		yield* restart();

		const replacement = processId();
		const after = yield* results();
		expect(replacement).not.toBe(original);
		expect(after.map((tab) => tab.map((result) => ({ id: result.id, pid: result.pid, tab: result.tab })))).toEqual(
			Array.from({ length: 12 }, (_, index) => [1, 2].map((id) => ({ id, pid: replacement, tab: `tab ${index + 1}` }))),
		);
		const firstReruns = after.map((tab) => Math.min(...tab.map((result) => result.readAt)));
		expect(Math.max(...firstReruns) - Math.min(...firstReruns)).toBeGreaterThan(50);
	},
);
