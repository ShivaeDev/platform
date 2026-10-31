import { expect } from "vitest";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

mergeLoop.it(
	"reconciles an accepted auto-merge request after its reply is lost and Fleet restarts",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		fleet.loseQueueReply();
		yield* fleet.finishWorker("one");
		const uncertain = yield* fleet.reconcile("one");
		expect(uncertain.value.mergeQueue).toEqual({ head: uncertain.value.result?.head, status: "requested" });
		expect(uncertain.value.decision).toBeUndefined();
		expect(fleet.queuedPullRequests()).toEqual([["1", uncertain.value.review?.head]]);
		fleet.advanceTime(60_000);
		yield* fleet.restart();
		const reconciled = yield* fleet.reconcile("one");
		expect(reconciled.value.mergeQueue).toEqual({ head: uncertain.value.result?.head, status: "queued" });
		expect(fleet.queueRequests()?.map((request) => request.variables)).toEqual([{ head: reconciled.value.review?.head, pr: "1" }]);
		expect(fleet.publishedDecisions()).toEqual([]);
	},
);
