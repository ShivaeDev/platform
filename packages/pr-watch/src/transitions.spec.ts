import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { autoMergeOff, baselineSaved, failingStatus, inQueue, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const [change, verb, printed] of [
	["merging", "merges", ["PR 1 merged"]],
	["closing without merging", "closes", ["PR 1 closed"]],
	["getting a merge conflict with auto-merge on", "conflicts", ["PR 1 conflict", "PR 1 stuck"]],
	["turning auto-merge off", "disablesAutoMerge", ["PR 1 auto-merge-off"]],
] as const) {
	watch.it(`PR 1 ${change} prints ${printed.join(" and ")}`, [openPr(1), watching(1), baselineSaved], function* (story) {
		yield* story[verb](1);

		yield* story.poll();

		expect(yield* story.printed()).toEqual(printed);
	});
}

watch.it(
	"a transition line carries PR 1's number, head branch and title",
	[openPr(1), watching(1), baselineSaved],
	function* ({ merges, poll, printedTransitions }) {
		yield* merges(1);

		yield* poll();

		expect(yield* printedTransitions()).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
	},
);

watch.it(
	"a transition line after a push carries PR 1's new branch and title, line break included",
	[openPr(1), watching(1), baselineSaved],
	function* ({ conflicts, poll, printedTransitions, pushesHead }) {
		yield* pushesHead(1, "new-branch", "new-head", "Changed\ntitle");
		yield* conflicts(1);

		yield* poll();

		expect(yield* printedTransitions()).toEqual([
			{ branch: "new-branch", event: "conflict", number: 1, title: "Changed\ntitle" },
			{ branch: "new-branch", event: "stuck", number: 1, title: "Changed\ntitle" },
		]);
	},
);

watch.it(
	"a push that changes only PR 1's branch and title prints nothing and saves the new branch and title",
	[openPr(1), watching(1), baselineSaved],
	function* ({ poll, printed, pushesHead, savedHead }) {
		yield* pushesHead(1, "new-branch", "new-head", "New title");

		yield* poll();

		yield* outcomes({
			"printed": [printed(), []],
			"saved head": [savedHead(1), "new-branch: New title"],
		});
	},
);

watch.it(
	"enabling auto-merge on PR 1 with failing checks prints stuck without repeating checks-failed",
	[openPr(1), autoMergeOff(1), failingStatus(1), watching(1), baselineSaved],
	function* ({ enablesAutoMerge, poll, printed }) {
		yield* enablesAutoMerge(1);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 stuck"]);
	},
);

for (const [state, verb] of [
	["closed", "merges"],
	["still open", "mergesStillListed"],
] as const) {
	watch.it(
		`queued PR 1 merging with a conflict while GitHub reports it ${state} prints only merged`,
		[openPr(1), inQueue(1), watching(1), baselineSaved],
		function* (story) {
			yield* story.conflicts(1);
			yield* story[verb](1);

			yield* story.poll();

			expect(yield* story.printed()).toEqual(["PR 1 merged"]);
		},
	);
}

watch.it(
	"in one round, PR 1 merging from the queue and PR 2 turning auto-merge off print one line each",
	[openPr(1, 2), inQueue(1), watching(1, 2), baselineSaved],
	function* ({ disablesAutoMerge, merges, poll, printed }) {
		yield* merges(1);
		yield* disablesAutoMerge(2);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 merged", "PR 2 auto-merge-off"]);
	},
);
