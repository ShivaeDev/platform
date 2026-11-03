import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

mergeLoop.it(
	"main advancing during CI-file observation does not hold a PR without CI changes",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		yield* fleet.finishWorker("one");
		fleet.advanceMainDuringFiles();

		const ready = yield* fleet.reconcile("one");

		expect(fleet.queuedPullRequests()).toEqual([["1", ready.value.result?.head]]);
		expect(fleet.publishedDecisions()).toEqual([]);
	},
);
