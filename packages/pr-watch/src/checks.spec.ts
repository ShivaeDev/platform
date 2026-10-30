import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { replies } from "#test/github.ts";
import { baselineSaved, openPr, sawChecksFailAndRecover, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const conclusion of ["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]) {
	watch.it(
		`a check run completing as ${conclusion} on PR 1 with auto-merge prints checks-failed and stuck`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ checkConcludes, poll, printed }) {
			yield* checkConcludes(1, { conclusion, status: "completed" });

			yield* poll();

			expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
		},
	);
}

for (const conclusion of ["neutral", "skipped", "success", null]) {
	watch.it(
		`a check run completing as ${conclusion} on PR 1 prints nothing`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ checkConcludes, poll, printed }) {
			yield* checkConcludes(1, { conclusion, status: "completed" });

			yield* poll();

			expect(yield* printed()).toEqual([]);
		},
	);
}

watch.it(
	"a check run still in progress on PR 1 prints nothing, even with a failure conclusion",
	[openPr(1), watching(1), baselineSaved],
	function* ({ checkConcludes, poll, printed }) {
		yield* checkConcludes(1, { conclusion: "failure", status: "in_progress" });

		yield* poll();

		expect(yield* printed()).toEqual([]);
	},
);

for (const state of ["failure", "error"]) {
	watch.it(
		`a ${state} commit status on PR 1 prints checks-failed and stuck`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ poll, printed, statusBecomes }) {
			yield* statusBecomes(1, state);

			yield* poll();

			expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
		},
	);
}

watch.it(
	"PR 1's check run failing again after it recovered prints checks-failed and stuck again",
	[openPr(1), watching(1), baselineSaved, sawChecksFailAndRecover(1)],
	function* ({ checkConcludes, poll, printed }) {
		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);

		yield* checkConcludes(1, { conclusion: "failure", status: "completed" });
		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck", "PR 1 checks-failed", "PR 1 stuck"]);
	},
);

watch.it(
	"after PR 1 moves to a new head, a failing status on that head prints checks-failed and stuck",
	[openPr(1), watching(1), baselineSaved],
	function* ({ poll, printed, pushesHead, statusBecomes }) {
		yield* pushesHead(1, "feature-1", "new-head", "Change 1");
		yield* statusBecomes(1, "failure");

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
	},
);

watch.it(
	"a failed check run on PR 1's second checks page prints checks-failed and stuck",
	[openPr(1), watching(1), baselineSaved],
	function* ({ failingCheckOnSecondPage, poll, printed }) {
		yield* failingCheckOnSecondPage(1);

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
	},
);

watch.it(
	"a failed second checks page fails the poll and keeps PR 1's saved snapshot free of the first page's failure",
	[openPr(1), watching(1), baselineSaved],
	function* ({ lastPoll, poll, printed, savedSnapshot, secondChecksPage }) {
		yield* secondChecksPage(1, replies.status(HttpStatus.fromLiteral("InternalServerError")));

		yield* poll();

		yield* outcomes({
			"poll": [lastPoll(), "failed: GitHub HTTP 500 (GET /repos/acme/project/checks)"],
			"printed": [printed(), []],
			"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
		});
	},
);

watch.it(
	"a checks page linking its next page on another origin fails the poll and keeps PR 1's saved snapshot free of its failure",
	[openPr(1), watching(1), baselineSaved],
	function* ({ checksPageLinksElsewhere, lastPoll, poll, printed, savedSnapshot }) {
		yield* checksPageLinksElsewhere(1);

		yield* poll();

		yield* outcomes({
			"poll": [lastPoll(), "failed: GitHub request failed: PaginationLinkError"],
			"printed": [printed(), []],
			"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
		});
	},
);

watch.it(
	"a required failing commit status on the second status page prints checks-failed and stuck",
	[openPr(1), watching(1), baselineSaved],
	function* ({ poll, printed, statusOnSecondPage }) {
		yield* statusOnSecondPage(1, "failure");

		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 checks-failed", "PR 1 stuck"]);
	},
);
