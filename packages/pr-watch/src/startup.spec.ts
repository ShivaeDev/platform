import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reads, replies } from "#test/github.ts";
import { autoMergeOff, conflicted, failingCheck, failingStatus, mergeabilityPending, openPr, watching, watchingFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const fleetAtStartup = [
	openPr(1, 2, 3, 4, 5),
	conflicted(1),
	failingStatus(2),
	conflicted(3),
	failingCheck(3, { conclusion: "failure", status: "completed" }),
	autoMergeOff(5),
	failingStatus(5),
	watchingFleet,
];

watch.it(
	"the first fleet poll reports every PR that is already stuck, and not PR 5, whose auto-merge is off",
	fleetAtStartup,
	function* ({ poll, printed }) {
		yield* poll();

		expect(yield* printed()).toEqual([
			"PR 1 conflict",
			"PR 1 stuck",
			"PR 2 checks-failed",
			"PR 2 stuck",
			"PR 3 conflict",
			"PR 3 checks-failed",
			"PR 3 stuck",
		]);
	},
);

watch.it("a restart after the first fleet poll does not report the stuck PRs again", fleetAtStartup, function* ({ poll, printed, restart }) {
	yield* poll();
	const reported = yield* printed();

	yield* restart();

	expect(yield* printed()).toEqual(reported);
});

watch.it("the first fleet poll saves a baseline for every open PR", fleetAtStartup, function* ({ poll, savedSnapshot }) {
	yield* poll();

	yield* outcomes({
		"PR 1": [savedSnapshot(1), "open, auto-merge, conflict"],
		"PR 2": [savedSnapshot(2), "open, auto-merge, failing checks"],
		"PR 3": [savedSnapshot(3), "open, auto-merge, conflict, failing checks"],
		"PR 4": [savedSnapshot(4), "open, auto-merge"],
		"PR 5": [savedSnapshot(5), "open, failing checks"],
	});
});

watch.it(
	"conflicted PR 1 is reported stuck only once its commit status, which answered HTTP 500 at startup, can be read",
	[openPr(1), conflicted(1), watching(1)],
	function* ({ answers, poll, printed, recovers }) {
		yield* answers(reads.status(1), replies.status(HttpStatus.fromLiteral("InternalServerError")));
		yield* poll();
		expect(yield* printed()).toEqual([]);

		yield* recovers(reads.status(1));
		yield* poll();

		expect(yield* printed()).toEqual(["PR 1 conflict", "PR 1 stuck"]);
	},
);

watch.it(
	"while GitHub computes PR 1's mergeability, a poll succeeds without printing or saving anything for it",
	[openPr(1), mergeabilityPending(1), watching(1)],
	function* ({ diagnostics, lastPoll, poll, printed, savedSnapshot }) {
		yield* poll();

		yield* outcomes({
			"diagnostics": [diagnostics(), []],
			"poll": [lastPoll(), "polled"],
			"printed": [printed(), []],
			"saved snapshot of PR 1": [savedSnapshot(1), "none"],
		});
	},
);
