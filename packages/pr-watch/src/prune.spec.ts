import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineSaved, merged, openPr, watching, watchingFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const [verb, event] of [
	["merges", "merged"],
	["closes", "closed"],
] as const) {
	watch.it(`once PR 1 ${verb}, a restart sends GitHub no request for it`, [openPr(1), watching(1), baselineSaved], function* (story) {
		yield* story[verb](1);
		yield* story.poll();
		expect(yield* story.printed()).toEqual([`PR 1 ${event}`]);

		yield* story.restart();

		yield* outcomes({
			"printed": [story.printed(), [`PR 1 ${event}`]],
			"requests": [story.lastRoundRequests(), []],
		});
	});
}

watch.it(
	"once PR 1 merged, a fleet restart only lists the open PRs",
	[openPr(1), watchingFleet, baselineSaved],
	function* ({ lastRoundRequests, merges, poll, restart }) {
		yield* merges(1);
		yield* poll();

		yield* restart();

		expect(yield* lastRoundRequests()).toEqual(["GET /repos/acme/project/pulls?state=open&per_page=100 200"]);
	},
);

watch.it(
	"after PR 1 merged, fleet polls the newly opened PRs 2 and 3 and keeps PR 1's merged snapshot without reading it",
	[openPr(1), watchingFleet, baselineSaved],
	function* ({ merges, opens, poll, pollTimes, savedSnapshot }) {
		yield* merges(1);
		yield* poll();

		yield* opens(2);
		yield* opens(3);
		yield* poll();

		yield* outcomes({
			"PR 1 reads": [pollTimes(1), ["00:00:00", "00:00:00"]],
			"PR 1 snapshot": [savedSnapshot(1), "merged, auto-merge"],
			"PR 2 snapshot": [savedSnapshot(2), "open, auto-merge"],
			"PR 3 snapshot": [savedSnapshot(3), "open, auto-merge"],
		});
	},
);

watch.it(
	"PR 1, already merged at the first poll, is saved without a merged line and not read again after a restart",
	[openPr(1), merged(1), watching(1)],
	function* ({ lastRoundRequests, poll, printed, restart, savedSnapshot }) {
		yield* poll();
		expect(yield* savedSnapshot(1)).toBe("merged, auto-merge");

		yield* restart();

		yield* outcomes({
			"printed": [printed(), []],
			"requests": [lastRoundRequests(), []],
		});
	},
);
