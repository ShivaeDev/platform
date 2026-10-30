import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Answer } from "#test/github.ts";
import { reads } from "#test/github.ts";
import { autoMergeOff, baselineSaved, checksAre, inQueue, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const status of ["completed", "in_progress"]) {
	watch.it(
		`PR 1 entering the queue prints only queued while an optional app check is ${status} with conclusion failure`,
		[
			openPr(1),
			autoMergeOff(1),
			checksAre(
				1,
				{ conclusion: "success", name: "CI", status: "completed" },
				{ conclusion: "failure", name: "Entire Gates", required: false, status },
				{ conclusion: null, name: "Queue CI", status: "in_progress" },
			),
			watching(1),
			baselineSaved,
		],
		function* ({ entersQueue, poll, printed }) {
			yield* entersQueue(1);

			yield* poll();

			expect(yield* printed()).toEqual(["PR 1 queued"]);
		},
	);
}

watch.it(
	"queued PR 1 prints checks-failed and stuck when a required check fails next to a failing optional app check",
	[openPr(1), inQueue(1), watching(1), baselineSaved],
	function* ({ checksBecome, poll, printed }) {
		yield* checksBecome(1, [
			{ conclusion: "failure", name: "CI", status: "completed" },
			{ conclusion: "failure", name: "Entire Gates", required: false, status: "completed" },
		]);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
	},
);

watch.it(
	"an optional app check that needs action leaves PR 1 ready to merge",
	[openPr(1), watching(1), baselineSaved],
	function* ({ checksBecome, poll, printed, savedSnapshot }) {
		yield* checksBecome(1, [{ conclusion: "action_required", name: "Entire Gates", required: false, status: "completed" }]);

		yield* poll();

		yield* outcomes({
			"printed": [printed(), []],
			"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
		});
	},
);

for (const state of ["failure", "error", "pending"]) {
	watch.it(
		`an optional ${state} commit status on PR 1 prints nothing`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ optionalStatusBecomes, poll, printed }) {
			yield* optionalStatusBecomes(1, state);

			yield* poll();

			expect(yield* printed()).toEqual([]);
		},
	);
}

watch.it(
	"a failed check run counts as required when GitHub returns its required flag on a second page",
	[openPr(1), watching(1), baselineSaved],
	function* ({ checkConcludes, poll, printed, requiredFlagsOnSecondPage }) {
		yield* checkConcludes(1, { conclusion: "failure", status: "completed" });
		yield* requiredFlagsOnSecondPage(1);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
	},
);

const unavailableFlags: readonly (readonly [Answer, string])[] = [
	[{ description: "errors only", reply: { body: { errors: [{ message: "Unavailable" }] } } }, "GitHub required checks: Unavailable"],
	[{ description: "a missing repository", reply: { body: { data: { repository: null } } } }, "Invalid GitHub checks response"],
	[
		{ description: "a missing repository and errors", reply: { body: { data: { repository: null }, errors: [{ message: "Partial response" }] } } },
		"GitHub required checks: Partial response",
	],
];

for (const [answer, failure] of unavailableFlags) {
	watch.it(
		`required-check flags answered with ${answer.description} fail the poll as "${failure}" and keep PR 1's snapshot`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ answers, checkConcludes, lastPoll, poll, printed, savedSnapshot }) {
			yield* checkConcludes(1, { conclusion: "failure", status: "completed" });
			yield* answers(reads.requiredChecks, answer);

			yield* poll();

			yield* outcomes({
				"poll": [lastPoll(), `failed: ${failure}`],
				"printed": [printed(), []],
				"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
			});
		},
	);
}
